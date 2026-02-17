# Split Mode Scroll Sync — Technical Reference

> Hybrid Segment Proportional 스크롤 동기화 구현 문서
> 최종 수정: 2026-02-17

---

## 1. Problem Definition

Split mode에서 좌측 CodeMirror 에디터와 우측 HTML 프리뷰의 스크롤을 동기화해야 한다.
두 패널은 근본적으로 다른 렌더링 모델을 사용한다:

| 속성            | Editor (CodeMirror 6)              | Preview (HTML)                                  |
| --------------- | ---------------------------------- | ----------------------------------------------- |
| 렌더링          | 고정 폭 monospace 텍스트           | 가변 폭 rich HTML                               |
| 높이 결정       | 줄 수 × 줄 높이 (거의 선형)        | 이미지, 수식, 다이어그램 등에 의해 비선형       |
| 스크롤 컨테이너 | `.cm-scroller` (`view.scrollDOM`)  | `<div ref={previewScrollRef}>`                  |
| 좌표 체계       | `BlockInfo.top` (content-space px) | `element.getBoundingClientRect()` + `scrollTop` |

단순 비율 매핑 (`scrollTop / scrollHeight`)은 이미지나 Mermaid 다이어그램이 포함된 문서에서
심각한 위치 불일치를 발생시킨다. VS Code의 접근 방식을 참고하여 **Hybrid Segment Proportional** 알고리즘을 구현했다.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    useSplitScrollSync                     │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Scroll   │───▸│ Anchor       │───▸│ Interpolation │  │
│  │ Detection│    │ Builder      │    │ Engine        │  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│       │                │                     │           │
│       │          ┌─────┴─────┐         ┌─────┴─────┐    │
│       │          │ data-     │         │ Segment   │    │
│       │          │ source-   │         │ Proportion│    │
│       │          │ line      │         │ al Map    │    │
│       │          └───────────┘         └───────────┘    │
│       │                                                  │
│  ┌────┴─────────────────────────────────────────────┐   │
│  │              Feedback Loop Prevention              │   │
│  │  Driver Lock · Programmatic Scroll Tracking       │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │              DOM Change Detection                  │   │
│  │  MutationObserver · ResizeObserver · Image Loads  │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 데이터 흐름

1. **Scroll Detection**: 에디터(RAF poll) 또는 프리뷰(DOM scroll event)에서 스크롤 변경 감지
2. **Anchor Build**: `data-source-line` 속성을 가진 프리뷰 DOM 노드를 순회하여 `(editorTop, previewTop)` 앵커 쌍 생성
3. **Interpolation**: 현재 scrollTop이 속한 앵커 구간을 binary search로 찾고, 구간 내 비율로 대상 scrollTop 계산
4. **Feedback Prevention**: driver lock + programmatic scroll tracking으로 무한 루프 차단

---

## 3. Source Line Injection (`markdownConfig.ts`)

스크롤 동기화의 전제 조건은 프리뷰 HTML의 각 블록 요소가 원본 마크다운의 몇 번째 줄에 해당하는지 아는 것이다.
markdown-it의 core ruler를 활용하여 블록 토큰에 `data-source-line` 속성을 주입한다.

### 3.1 Core Ruler

```typescript
function addBlockSourceLineAttributes(parser: MarkdownIt): void {
  parser.core.ruler.after('block', 'source_line_attrs', state => {
    for (const token of state.tokens) {
      const line = sourceLineFromToken(token)
      if (!line) continue

      const isOpeningBlock = token.block && token.nesting === 1
      const isStandaloneBlock = token.block && token.nesting === 0
      if (!isOpeningBlock && !isStandaloneBlock) continue

      token.attrSet('data-source-line', String(line))
    }
  })
}
```

- `token.map`은 `[startLine, endLine]` (0-based)을 포함. `startLine + 1`로 1-based 변환
- Opening block (`nesting === 1`: `<p>`, `<h1>`, `<blockquote>` 등)과 standalone block (`nesting === 0`: `<hr>` 등)에만 적용
- Closing tag (`nesting === -1`)와 inline token은 건너뜀

### 3.2 Custom Renderer Override

`fence`와 `code_block`은 markdown-it가 자체 renderer로 HTML을 생성하므로 core ruler의 `attrSet`이 적용되지 않는다.
별도의 renderer override로 생성된 HTML 문자열에 직접 속성을 삽입한다:

```typescript
function withSourceLineAttr(html: string, line: number | null): string {
  if (!line || !html.startsWith('<')) return html
  if (/^<pre\b[^>]*\bdata-source-line=/.test(html)) return html
  return html.replace(/^<([a-zA-Z][\w:-]*)/, `<$1 data-source-line="${line}"`)
}
```

`math_block` renderer에도 동일하게 적용하여 KaTeX 블록 수식에도 source line 정보를 포함한다.

### 3.3 결과 HTML 예시

```html
<h1 data-source-line="1">Welcome to BoltDown</h1>
<p data-source-line="3">A lightning-fast Markdown editor...</p>
<pre data-source-line="10" class="language-typescript">
  <code>...</code>
</pre>
<div data-source-line="25" class="katex-block">...</div>
```

---

## 4. Scroll Anchor System (`useSplitScrollSync.ts`)

### 4.1 ScrollAnchor 타입

```typescript
interface ScrollAnchor {
  editorTop: number // Y position in editor coordinate space (content-space px)
  previewTop: number // Y position in preview coordinate space (content-space px)
}
```

기존 line-number 기반 방식과 달리 **직접 Y 좌표 쌍**을 사용한다.
이로써 line number → editor pixel, line number → preview pixel 두 단계 변환이 한 단계로 줄어든다.

### 4.2 Anchor Build (`buildScrollAnchors`)

```
Preview DOM                          CodeMirror
┌─────────────────┐                  ┌─────────────────┐
│ [data-source-   │                  │                  │
│  line="1"]      │──┐               │ line 1 ─────────│──┐
│  rect.top=0     │  │               │ blockAt.top=0   │  │
│                  │  │  Anchor #1   │                  │  │
│                  │  └──(0, 0)──────│──────────────────│──┘
│ [data-source-   │                  │                  │
│  line="5"]      │──┐               │ line 5 ─────────│──┐
│  rect.top=120   │  │  Anchor #2   │ blockAt.top=80  │  │
│                  │  └──(80, 120)───│──────────────────│──┘
│                  │                  │                  │
│ [data-source-   │                  │                  │
│  line="15"]     │──┐               │ line 15 ────────│──┐
│  rect.top=800   │  │  Anchor #3   │ blockAt.top=280 │  │
│                  │  └──(280, 800)──│──────────────────│──┘
└─────────────────┘                  └─────────────────┘
```

**알고리즘**:

1. 프리뷰 컨테이너에서 `[data-source-line]` 속성을 가진 모든 요소를 쿼리
2. 각 요소에 대해:
   - `previewTop` = `rect.top - previewRect.top + previewScrollEl.scrollTop` (content-space 변환)
   - `editorTop` = `view.lineBlockAt(lineObj.from).top` (CM6 content-space Y 좌표)
3. 동일 `editorTop`에 대해 가장 작은 `previewTop`만 유지 (중복 제거)
4. `editorTop` 기준 오름차순 정렬

**CM6 API 활용**:

- `view.state.doc.line(lineNumber)`: 1-based line number → `Line` 객체 (`from` offset 포함)
- `view.lineBlockAt(pos)`: character offset → `BlockInfo` (`top`, `height`, `from`, `to` 등)
- `BlockInfo.top`: 문서 최상단부터의 Y 좌표 (content-space, px 단위)

### 4.3 Lazy Rebuild

앵커 배열은 `anchorsDirtyRef` 플래그로 lazy invalidation한다:

- **Dirty 시점**: MutationObserver 감지, ResizeObserver 감지, 이미지 로드 완료
- **Rebuild 시점**: 다음 스크롤 동기화 시 `ensureAnchors()` 호출 때

이 패턴으로 빠른 연속 DOM 변경 시 불필요한 재빌드를 방지한다.

---

## 5. Interpolation Engine

### 5.1 Segment Proportional Mapping

앵커 배열을 구간(segment)으로 분할하고, 각 구간 내에서 선형 보간(linear interpolation)한다.

```
scrollTop=150일 때:

Anchor[i-1]: (editorTop=80, previewTop=120)     ← prevFrom=80, prevTo=120
Anchor[i]:   (editorTop=280, previewTop=800)     ← nextFrom=280, nextTo=800

ratio = (150 - 80) / (280 - 80) = 70/200 = 0.35
targetPreviewTop = 120 + 0.35 × (800 - 120) = 120 + 238 = 358
```

### 5.2 Content-Space vs Scroll-Space 문제

**핵심 통찰**: 앵커의 `editorTop`/`previewTop`은 content-space (0 ~ contentHeight)에 있지만,
`scrollTop`은 scroll-space (0 ~ scrollableHeight)에만 존재한다.

```
scrollableHeight = contentHeight - viewportHeight
```

문서 하단부의 앵커는 `editorTop`이 `editorScrollable`를 초과할 수 있다.
이 경우 `scrollTop`이 해당 앵커에 절대로 도달할 수 없어, 문서 끝부분이 동기화되지 않는다.

**해결**: `(fromScrollable, toScrollable)`을 synthetic endpoint로 사용한다.

```typescript
function interpolateScroll(
  scrollTop: number,
  anchors: readonly ScrollAnchor[],
  getFrom: (a: ScrollAnchor) => number,
  getTo: (a: ScrollAnchor) => number,
  fromScrollable: number,
  toScrollable: number
): number {
  // ...
  let nextFrom = fromScrollable // 기본값: scroll range 끝
  let nextTo = toScrollable
  if (nextIndex < anchors.length) {
    const next = anchors[nextIndex]!
    const nf = getFrom(next)
    if (nf <= fromScrollable) {
      // 앵커가 스크롤 범위 내에 있을 때만 사용
      nextFrom = nf
      nextTo = getTo(next)
    }
    // else: 앵커가 스크롤 범위를 초과 → (fromScrollable, toScrollable) 유지
  }
  // ...
}
```

이로써 마지막 유효 앵커 이후의 구간이 `(lastAnchor, scrollEnd)` → `(lastAnchorTarget, targetScrollEnd)`로
정확하게 매핑된다.

### 5.3 Binary Search (`lowerBound`)

앵커 배열에서 `scrollTop` 이상인 첫 번째 요소를 O(log n)으로 찾는다.

```typescript
function lowerBound<T>(items: readonly T[], value: number, getValue: (item: T) => number): number {
  let low = 0
  let high = items.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (getValue(items[mid]!) < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}
```

Generic 구현으로 accessor function을 통해 editor→preview, preview→editor 양방향에서 재사용한다.

### 5.4 DRY: 양방향 단일 함수

`interpolateScroll()`은 accessor function `getFrom`/`getTo`를 파라미터로 받아
방향에 무관한 단일 구현을 제공한다:

```typescript
// Editor → Preview
mapEditorToPreview(scrollTop, anchors, editorScrollable, previewScrollable)
  → interpolateScroll(scrollTop, anchors, a => a.editorTop, a => a.previewTop, ...)

// Preview → Editor
mapPreviewToEditor(scrollTop, anchors, editorScrollable, previewScrollable)
  → interpolateScroll(scrollTop, anchors, a => a.previewTop, a => a.editorTop, ...)
```

---

## 6. Feedback Loop Prevention

양방향 동기화에서 A의 스크롤 변경이 B를 움직이고, B의 변경이 다시 A를 움직이는
무한 루프를 방지해야 한다. 두 가지 메커니즘을 조합한다.

### 6.1 Driver Lock

```
type SyncDriver = 'editor' | 'preview'
const DRIVER_LOCK_MS = 160
```

스크롤 동기화를 실행한 쪽이 160ms 동안 "driver"로 잠금된다.
잠금 기간 동안 반대쪽의 스크롤 이벤트는 동기화를 트리거하지 않는다.

```
Timeline:
  t=0    Editor scrolls → lock('editor') → preview.scrollTop = X
  t=50   Preview scroll event fires (feedback) → driverLock === 'editor' → SKIP
  t=160  Lock expires → driverLock = null
  t=200  Preview user scroll → lock('preview') → editor.scrollTop = Y
```

### 6.2 Programmatic Scroll Tracking

Driver lock만으로는 lock 만료 후 잔여 feedback을 완전히 차단하지 못한다.
마지막으로 프로그래밍적으로 설정한 scrollTop 값을 기록하고,
현재 scrollTop과 비교하여 epsilon(1px) 이내면 무시한다:

```typescript
const lastProgrammaticPreviewTopRef = useRef(-1)
const lastProgrammaticEditorTopRef = useRef(-1)

// 동기화 실행 시
lastProgrammaticPreviewTopRef.current = targetTop
previewScrollEl.scrollTop = targetTop

// 피드백 감지 시
if (Math.abs(st - lastProgrammaticEditorTopRef.current) > SCROLL_EPSILON_PX) {
  scheduleEditorSync() // 사용자 스크롤만 동기화 트리거
}
```

---

## 7. WKWebView Compatibility

### 문제

Tauri 2.0은 macOS에서 WKWebView를 사용한다. WKWebView는 CodeMirror 6의 `.cm-scroller`에서
네이티브 `scroll` 이벤트를 발생시키지 않는다. 이는 CodeMirror가 내부적으로 scroll을 관리하는
방식과 WKWebView의 이벤트 전파 차이에 기인한다.

### 해결: RAF Poll

`requestAnimationFrame` 루프로 `view.scrollDOM.scrollTop`을 매 프레임 폴링한다:

```typescript
let lastEditorScrollTop = view.scrollDOM.scrollTop
let editorPollRAF = 0

const pollEditorScroll = () => {
  if (disposed) return
  const st = view.scrollDOM.scrollTop
  if (st !== lastEditorScrollTop) {
    lastEditorScrollTop = st
    if (Math.abs(st - lastProgrammaticEditorTopRef.current) > SCROLL_EPSILON_PX) {
      scheduleEditorSync()
    }
  }
  editorPollRAF = window.requestAnimationFrame(pollEditorScroll)
}
```

- **왜 이벤트 대신 폴링인가**: WKWebView에서 `scroll` 이벤트가 누락되는 반면, RAF poll은 모든 환경에서 동작
- **성능 영향**: 단순 숫자 비교만 수행하므로 프레임당 ~0.01ms 미만
- **프리뷰는 DOM 이벤트 사용**: 프리뷰 패널은 일반 `<div>`이므로 `scroll` 이벤트가 정상 동작

---

## 8. DOM Change Detection

프리뷰 DOM이 변경되면 앵커가 무효화되므로 재빌드가 필요하다.
세 가지 감시 메커니즘을 사용한다:

### 8.1 MutationObserver

```typescript
const mutationObserver = new MutationObserver(() => {
  markAnchorsDirty()
})

mutationObserver.observe(previewScrollEl, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'src', 'data-source-line'],
})
```

- `childList`: 새 요소 추가/제거 (마크다운 편집 시)
- `attributes`: 스타일 변경, 이미지 소스 변경, Mermaid 렌더링 완료 등
- `attributeFilter`로 관련 속성만 감시하여 불필요한 트리거 최소화

### 8.2 ResizeObserver

```typescript
const resizeObserver = new ResizeObserver(() => {
  markAnchorsDirty()
  scheduleEditorSync()
})

resizeObserver.observe(previewScrollEl)
const previewContent = previewScrollEl.firstElementChild
if (previewContent instanceof HTMLElement) {
  resizeObserver.observe(previewContent)
}
```

- 프리뷰 컨테이너와 첫 번째 자식(content wrapper) 모두 감시
- 윈도우 리사이즈, split ratio 변경 시 앵커 재빌드 + 즉시 동기화

### 8.3 Image Load Tracking

```typescript
function trackImageLoads(previewScrollEl: HTMLDivElement, onImageLoaded: () => void): () => void {
  const controller = new AbortController()
  const images = previewScrollEl.querySelectorAll<HTMLImageElement>('img')

  for (const img of images) {
    if (img.complete) continue
    img.addEventListener('load', onImageLoaded, { signal: controller.signal })
    img.addEventListener('error', onImageLoaded, { signal: controller.signal })
  }

  return () => controller.abort()
}
```

- 이미지 로드 완료 시 레이아웃이 변경되므로 앵커 재빌드 필요
- `AbortController`로 한 번에 모든 리스너 정리
- `error` 이벤트도 처리하여 로드 실패 시에도 레이아웃 안정화

---

## 9. Integration Point (`MainLayout.tsx`)

```typescript
export default memo(function MainLayout({ editor, preview, toolbar }) {
  const previewScrollRef = useRef<HTMLDivElement>(null)

  useSplitScrollSync({
    enabled: mode === 'split',
    previewScrollRef,
  })

  return (
    // ...
    <div ref={previewScrollRef} className="flex-1 overflow-auto overscroll-contain">
      {preview}
    </div>
    // ...
  )
})
```

- `enabled`가 `false`이면 모든 리스너/옵저버를 해제하고 상태를 초기화
- `previewScrollRef`는 프리뷰의 스크롤 가능한 컨테이너를 가리킴
- `editorViewRef`는 `EditorViewContext`에서 제공 (CodeMirror `EditorView` 인스턴스)

---

## 10. File Structure

```
src/
├── hooks/
│   └── useSplitScrollSync.ts    # 스크롤 동기화 훅 (전체 구현)
│       ├── clamp()               # 범위 제한 유틸
│       ├── getScrollableHeight() # scrollHeight - clientHeight
│       ├── lowerBound()          # Generic binary search
│       ├── buildScrollAnchors()  # data-source-line → anchor 쌍 생성
│       ├── interpolateScroll()   # 핵심: segment proportional 보간
│       ├── mapEditorToPreview()  # editor scrollTop → preview scrollTop
│       ├── mapPreviewToEditor()  # preview scrollTop → editor scrollTop
│       ├── trackImageLoads()     # 이미지 로드 감시
│       └── useSplitScrollSync()  # React hook (이벤트 바인딩, 옵저버, RAF)
├── utils/
│   └── markdownConfig.ts         # markdown-it 설정 + data-source-line 주입
│       ├── sourceLineFromToken()
│       ├── withSourceLineAttr()
│       └── addBlockSourceLineAttributes()
└── components/layout/
    └── MainLayout.tsx            # previewScrollRef 제공 + 훅 연결
```

---

## 11. Known Limitations & Future Work

| 항목                        | 상태      | 설명                                                                                    |
| --------------------------- | --------- | --------------------------------------------------------------------------------------- |
| Inline 요소 매핑            | 미지원    | `data-source-line`은 block-level 요소에만 적용. 긴 paragraph 내 위치는 구간 보간에 의존 |
| 동적 이미지 리사이즈        | 부분 지원 | 최초 로드는 감지하지만, lazy-loaded 이미지의 크기 변경은 MutationObserver에 의존        |
| Mermaid 렌더링 지연         | 부분 지원 | 비동기 렌더링 완료 후 DOM 변경으로 앵커 재빌드. 렌더링 중간 상태에서 일시적 불일치 가능 |
| 접힌 코드 블록              | 미지원    | CodeMirror fold가 적용된 상태에서 `lineBlockAt` 반환값이 달라질 수 있음                 |
| 매우 긴 문서 (5000+ lines)  | 미검증    | 앵커 빌드와 binary search는 O(n log n)이나, DOM 쿼리 비용이 병목 가능                   |
| Content-space anchor 정밀도 | 제한적    | `getBoundingClientRect()`는 서브픽셀 정밀도이나, 빠른 스크롤 시 리플로우 비용 존재      |

---

## Appendix: Key CodeMirror 6 APIs

| API                        | 반환                                  | 용도                                 |
| -------------------------- | ------------------------------------- | ------------------------------------ |
| `view.state.doc.line(n)`   | `Line { from, to, text }`             | 1-based 줄 번호 → 문자 offset        |
| `view.lineBlockAt(pos)`    | `BlockInfo { top, height, from, to }` | 문자 offset → content-space Y 좌표   |
| `view.scrollDOM`           | `HTMLElement`                         | CM6 스크롤 컨테이너 (`.cm-scroller`) |
| `view.scrollDOM.scrollTop` | `number`                              | 현재 스크롤 위치                     |
| `view.state.doc.lines`     | `number`                              | 전체 줄 수                           |

`BlockInfo.top`은 문서 최상단(content-space origin)으로부터의 Y 좌표이며,
`documentTop` (기본값 0)이 오프셋으로 적용된다. 에디터의 패딩이 포함되지 않으므로
순수 content-space 좌표로 앵커에 직접 사용할 수 있다.
