# WYSIWYG 아키텍처 기술 문서

## 개요 (Overview)

BoltDown의 WYSIWYG 시스템은 "Zen 모드"에서 마크다운 에디터 내에 실시간 인라인 프리뷰를 제공합니다. 969줄의 모놀리식 파일에서 10개의 모듈식 파일로 리팩토링되었으며, LRU 캐싱을 통해 성능을 최적화했습니다.

**핵심 특징:**

- CodeMirror 6 StateField 기반 decoration 시스템
- Two-tier reveal logic (block-level + inline-level)
- Widget 기반 렌더링 (이미지, 수식, 코드 블록, Mermaid 다이어그램, 테이블 등)
- LRU 캐싱으로 고비용 렌더링 최적화
- 의존성 주입(DI) 패턴으로 모듈 간 결합도 최소화

## 모듈 구조 (Module Structure)

```
src/components/editor/extensions/wysiwyg/
├── index.ts                  # Entry point - wysiwygExtension() factory
├── buildDecorations.ts       # Orchestrator - 전체 decoration 빌드 로직
├── utils.ts                  # Shared utilities
└── Widget files:
    ├── ImageWidget.ts        # 이미지 렌더링
    ├── InlineMathWidget.ts   # 인라인 수식 (KaTeX)
    ├── BlockMathWidget.ts    # 블록 수식 (KaTeX)
    ├── CodeBlockWidget.ts    # 코드 블록 (Prism.js)
    ├── MermaidWidget.ts      # Mermaid 다이어그램
    ├── TableWidget.ts        # 테이블 렌더링
    └── BulletWidget.ts       # 불릿 리스트 마커
```

### index.ts — Entry Point

`wysiwygExtension(mermaidSecurityLevel)` 팩토리 함수가 StateField를 반환합니다 (ViewPlugin이 **아님**).

```typescript
export function wysiwygExtension(mermaidSecurityLevel: MermaidSecurityLevel = 'strict') {
  const wysiwygDecorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, mermaidSecurityLevel)
    },
    update(decorations, tr) {
      // docChanged OR selection changed → full rebuild
      if (!tr.docChanged && !tr.selection) return decorations
      return buildDecorations(tr.state, mermaidSecurityLevel)
    },
    provide: field => EditorView.decorations.from(field),
  })
  return wysiwygDecorations
}
```

**핵심 설계 결정:**

- **Full rebuild on every change**: 변경사항마다 전체 decoration을 재구성합니다
- **LRU 캐시가 이를 가능하게 함**: 고비용 렌더링(KaTeX, Mermaid)은 캐시에서 서빙되므로 실제 비용은 트리 순회와 decoration 조립뿐입니다
- **점진적 업데이트를 시도하지 않음**: Two-tier reveal 시스템과 코드 범위 간 교차 참조로 인해 mapping + partial rebuild는 취약합니다

### buildDecorations.ts — Orchestrator

모든 decoration 로직을 조율하는 중앙 함수입니다.

```typescript
export function buildDecorations(
  state: EditorState,
  mermaidSecurityLevel: MermaidSecurityLevel
): DecorationSet
```

**동작 방식:**

1. `ensureSyntaxTree(state, state.doc.length, 50)` — 50ms 타임아웃으로 구문 트리 확보
2. `tree.iterate()` — 전체 트리를 순회하며 노드별 decoration 생성
3. `applyInlineFormatting()` — 볼드, 이탤릭, 취소선, 인라인 코드, 링크 처리
4. `appendMathDecorations()` — 별도 패스로 수식 처리 (코드 범위 제외)

**DI 패턴 예시 (ImageWidget):**

```typescript
// buildDecorations.ts에서 markdownFilePath를 한 번만 읽어 생성자로 전달
const { tabs, activeTabId } = useTabStore.getState()
const markdownFilePath = activeTab?.filePath ?? null
// ...
new ImageWidget(url, alt, markdownFilePath) // 생성자 주입
```

### utils.ts — Shared Utilities

모든 widget에서 공유하는 유틸리티 함수와 상수:

```typescript
// 헤딩 스타일 상수
export const headingStyles: Record<string, string> = {
  '1': 'font-size: 2em; font-weight: 700; line-height: 1.2;',
  '2': 'font-size: 1.5em; font-weight: 700; line-height: 1.3;',
  // ...
}

// 동적 위젯 높이 변경 시 에디터 레이아웃 재측정 스케줄링
export function scheduleEditorMeasure(view: EditorView) {
  requestAnimationFrame(() => {
    if (!view.dom.isConnected) return
    view.requestMeasure()
  })
}

// 범위 체크 유틸리티
export function isSelectionInRange(selection, from, to): boolean
export function isCursorOnRangeLine(state, cursorLine, from, to): boolean
export function createRangeChecker(ranges: DocRange[]): (pos: number) => boolean
```

## 핵심 개념 (Core Concepts)

### StateField vs ViewPlugin

WYSIWYG는 **StateField**를 사용합니다 (ViewPlugin이 아님).

**이유:**

- Decoration은 문서 상태의 순수 함수입니다 (순수 파생 데이터)
- StateField는 트랜잭션마다 `update()` 호출을 보장합니다
- `provide: field => EditorView.decorations.from(field)`로 decoration 레이어에 연결

### Two-Tier Reveal Logic

커서 위치에 따라 마크다운 소스를 드러내는 두 단계 전략:

```typescript
const revealBlock = cursorInRange || cursorOnNodeLine
const revealInline = cursorInRange
```

**1. Block-level reveal (`revealBlock`)**

- 커서가 블록 노드와 **같은 줄**에 있으면 활성화
- 블록 전체를 마크다운 소스로 표시 (widget 숨김)
- 적용 대상: 이미지, 테이블, 코드 블록, 수평선, 수식 블록

**2. Inline-level reveal (`revealInline`)**

- 커서가 인라인 노드 **내부**에 있으면 활성화
- 포맷팅 마커를 반투명으로 표시 (완전히 숨기지 않음)
- 적용 대상: 볼드, 이탤릭, 취소선, 인라인 코드, 링크

**예시 — 볼드 텍스트:**

```typescript
// cursor outside: **text** → text (markers hidden)
// cursor inside:  **text** → **text** (markers 35% opacity)
if (!revealInline) {
  decorations.push(Decoration.replace({}).range(from, from + 2)) // ** 숨김
} else {
  decorations.push(
    Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(from, from + 2)
  )
}
```

### Decoration Rebuild Strategy

**전략: Full rebuild on every change**

```typescript
update(decorations, tr) {
  if (!tr.docChanged && !tr.selection) return decorations
  return buildDecorations(tr.state, mermaidSecurityLevel)  // 전체 재구성
}
```

**왜 점진적 업데이트를 하지 않나?**

1. **LRU 캐시가 full rebuild를 저렴하게 만듭니다** — KaTeX, Mermaid는 캐시 히트
2. **Two-tier reveal 복잡도** — 커서 이동만으로도 decoration 구조가 변경됨
3. **코드 범위 교차 참조** — 수식 처리 시 코드 범위를 제외해야 함 (state 간 mapping 취약)

**비용 분석:**

- **캐시 히트**: KaTeX/Mermaid 렌더링 0ms (캐시에서 HTML 문자열 반환)
- **실제 비용**: 트리 순회 (~10ms for 1000 lines) + decoration 조립 (~5ms)
- **사용자 체감**: 60fps 유지 가능 (16ms 미만)

## 캐싱 전략 (LRU Caching Pattern)

### LruCache 구현 (`src/utils/cache.ts`)

```typescript
export class LruCache<V> {
  private readonly map: Map<string, V>
  private readonly maxSize: number

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key) // 먼저 삭제해서 끝으로 이동
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest (first key in insertion order)
      const firstKey = this.map.keys().next().value as string
      this.map.delete(firstKey)
    }
    this.map.set(key, value)
  }
}
```

**특징:**

- **Map의 삽입 순서 보장** 활용 — first key = oldest entry
- **get() 시 MRU로 이동** — delete + set으로 재삽입
- **용량 초과 시 LRU 제거** — first key 삭제

### 캐시 인스턴스 맵

```
src/utils/cache.ts — LruCache<V> class
├── Map-based, insertion-order eviction
├── get(): move to end (most recently used)
├── set(): evict oldest if at capacity
└── clear(), size getter

Instances:
├── wysiwygKatexCache (200 entries) — InlineMathWidget.ts, BlockMathWidget.ts 공유
├── mermaidSvgCache (50 entries) — MermaidWidget.ts
├── katexCache (200 entries) — markdownConfig.ts (Preview 경로)
└── mermaidPreviewCache (50 entries) — MarkdownPreview.tsx
```

**캐시 키 전략:**

- **KaTeX**: `${displayMode}:${expression}` (예: `i:E=mc^2`, `b:\int_0^1 x dx`)
- **Mermaid**: `${code}:${theme}:${securityLevel}` (예: `graph TD...:dark:strict`)

**캐시 무효화:**

- 문서 변경 시 캐시를 **클리어하지 않습니다**
- 이유: 동일한 수식/다이어그램은 항상 동일하게 렌더링됩니다
- LRU 정책으로 오래된 항목은 자연스럽게 제거됩니다

**성능 영향:**

```
캐시 미스 (첫 렌더링):
  KaTeX: ~5-20ms per formula
  Mermaid: ~50-200ms per diagram

캐시 히트 (이후 렌더링):
  KaTeX: <1ms (HTML 문자열 조회)
  Mermaid: <1ms (SVG 문자열 조회)

결과: 200개 수식 문서도 부드럽게 편집 가능 (full rebuild가 저렴함)
```

## 위젯 패턴 (Widget Patterns)

모든 widget은 `WidgetType`을 확장하며 세 가지 공통 패턴을 따릅니다:

### 1. 기본 Widget 구조

```typescript
import { WidgetType } from '@codemirror/view'

export class MyWidget extends WidgetType {
  constructor(private data: string) {
    super()
  }

  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-my-widget'
    // rendering logic
    return el
  }

  eq(other: MyWidget) {
    return this.data === other.data
  }

  ignoreEvent() {
    return false // 클릭 시 커서 이동 허용 (편집 가능)
  }
}
```

### 2. 필수 메서드

**`toDOM(): HTMLElement`**

- DOM 요소를 생성하여 반환
- 매번 새로운 요소를 생성합니다 (재사용하지 않음)

**`eq(other: WidgetType): boolean`**

- 콘텐츠가 동일하면 `true` 반환
- 동일한 위치의 동일한 콘텐츠는 재렌더링하지 않음 (성능 최적화)
- 모든 필드를 비교해야 합니다

**`ignoreEvent(): boolean`**

- **항상 `false` 반환** — 클릭 이벤트를 에디터로 전달 (click-to-edit)
- `true`를 반환하면 widget이 클릭을 소비하여 편집 불가

### 3. Sanitization 패턴

innerHTML을 사용하는 경우 **반드시 sanitize** 함수 사용:

```typescript
import { sanitizeKatexHtml, sanitizeSvgHtml, sanitizeCodeHtml } from '@/utils/sanitize'

// KaTeX 출력
const html = katex.renderToString(...)
el.innerHTML = sanitizeKatexHtml(html)

// SVG (Mermaid)
const svg = await mermaid.render(...)
el.innerHTML = sanitizeSvgHtml(svg)

// Code (Prism.js)
const highlighted = Prism.highlight(...)
el.innerHTML = sanitizeCodeHtml(highlighted)
```

### 4. 동적 높이 Widget 패턴

이미지나 Mermaid처럼 로딩 후 높이가 변하는 widget은 `scheduleEditorMeasure()` 호출:

```typescript
import { scheduleEditorMeasure } from './utils'

toDOM(view: EditorView) {
  const img = document.createElement('img')
  img.addEventListener('load', () => scheduleEditorMeasure(view), { once: true })
  img.addEventListener('error', () => scheduleEditorMeasure(view), { once: true })
  img.src = this.url
  return img
}
```

### 5. 비동기 렌더링 패턴 (Mermaid)

비동기 렌더링에서는 **stale render 방지**를 위한 token 체계 사용:

```typescript
let renderToken = 0

async function renderInto(container: HTMLDivElement, code: string) {
  const token = `${++renderToken}`
  container.dataset.token = token

  const result = await expensiveAsyncRender(code)

  // Render가 완료되었을 때 컨테이너가 여전히 유효한지 확인
  if (!container.isConnected || container.dataset.token !== token) {
    return // Stale render, discard
  }

  container.innerHTML = result
}
```

**왜 필요한가?**

- 사용자가 빠르게 타이핑하면 여러 비동기 렌더링이 동시에 진행됩니다
- 나중에 시작한 렌더링이 먼저 완료될 수 있습니다 (race condition)
- Token이 일치하지 않으면 오래된 결과를 버립니다

## 의존성 주입 (Dependency Injection)

### 문제: Widget 내부에서 Zustand Store 접근

**안티패턴:**

```typescript
// ❌ BAD: Widget toDOM()에서 직접 store 접근
toDOM() {
  const filePath = useTabStore.getState().tabs.find(...)?.filePath  // 매번 호출
  // ...
}
```

**문제점:**

1. `toDOM()`은 수백 번 호출될 수 있음 (전체 문서 렌더링)
2. 매번 store를 조회하면 성능 저하
3. Widget이 store에 강하게 결합됨 (테스트 어려움)

### 해결: Constructor Injection

**올바른 패턴:**

```typescript
// ✅ GOOD: buildDecorations.ts에서 한 번만 읽어서 생성자로 전달
export function buildDecorations(state: EditorState, ...): DecorationSet {
  // Read once at the top level
  const { tabs, activeTabId } = useTabStore.getState()
  const markdownFilePath = activeTab?.filePath ?? null

  tree.iterate({
    enter(node) {
      // Pass via constructor (DI)
      new ImageWidget(src, alt, markdownFilePath)
    }
  })
}

// ImageWidget.ts
export class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
    private markdownFilePath: string | null  // Injected dependency
  ) {
    super()
  }

  toDOM() {
    // Use constructor parameter, no store access
    img.src = resolveImageSrcForDisplay(this.src, this.markdownFilePath)
    return img
  }

  eq(other: ImageWidget) {
    return this.src === other.src &&
           this.alt === other.alt &&
           this.markdownFilePath === other.markdownFilePath  // 비교에 포함
  }
}
```

**장점:**

1. Store 조회는 문서당 1회 (O(1) vs O(n))
2. Widget이 store에 독립적 (느슨한 결합)
3. 단위 테스트 용이 (mock 주입 가능)
4. `eq()` 메서드도 단순해짐 (필드 비교만)

## 새 위젯 추가 가이드 (How to Add a New Widget)

### 1단계: Widget 클래스 생성

`src/components/editor/extensions/wysiwyg/MyNewWidget.ts` 파일 생성:

```typescript
import { WidgetType } from '@codemirror/view'
import { sanitizeXxxHtml } from '@/utils/sanitize'

export class MyNewWidget extends WidgetType {
  constructor(private content: string) {
    super()
  }

  toDOM() {
    const el = document.createElement('div')
    el.className = 'cm-my-new-widget'

    // Render logic here
    // If using innerHTML, MUST sanitize:
    el.innerHTML = sanitizeXxxHtml(renderedContent)

    return el
  }

  eq(other: MyNewWidget) {
    return this.content === other.content
  }

  ignoreEvent() {
    return false // Allow click-to-edit
  }
}
```

### 2단계: LRU 캐시 추가 (고비용 렌더링인 경우)

렌더링이 5ms 이상 걸리면 캐싱 고려:

```typescript
import { LruCache } from '@/utils/cache'

// Export cache for potential reuse
export const myNewWidgetCache = new LruCache<string>(100) // Adjust size

export class MyNewWidget extends WidgetType {
  toDOM() {
    const cacheKey = `${this.content}:${this.options}`
    let html = myNewWidgetCache.get(cacheKey)

    if (html === undefined) {
      html = expensiveRender(this.content)
      myNewWidgetCache.set(cacheKey, html)
    }

    el.innerHTML = sanitizeXxxHtml(html)
    return el
  }
}
```

### 3단계: buildDecorations.ts에 decoration 로직 추가

```typescript
import { MyNewWidget } from './MyNewWidget'

export function buildDecorations(state: EditorState, ...): DecorationSet {
  // ...
  tree.iterate({
    enter(node) {
      // Add your node type check
      if (node.name === 'MyNewNodeType') {
        const content = state.sliceDoc(from, to)

        // Choose appropriate reveal logic
        const revealBlock = cursorInRange || cursorOnNodeLine

        if (!revealBlock) {
          decorations.push(
            Decoration.replace({
              widget: new MyNewWidget(content),
              block: true,  // or false for inline
            }).range(from, to)
          )
        }
      }
    }
  })
}
```

### 4단계: 의존성이 필요한 경우 DI 적용

Store나 설정값이 필요한 경우:

```typescript
// buildDecorations.ts 최상단에서 한 번만 읽기
const config = useSettingsStore.getState().someConfig

// Widget 생성 시 주입
new MyNewWidget(content, config)

// Widget 클래스에서 constructor로 받기
constructor(
  private content: string,
  private config: SomeConfig  // Injected
) {
  super()
}
```

### 5단계: Widget 파일에서 export

```typescript
// MyNewWidget.ts
export class MyNewWidget extends WidgetType { ... }
export const myNewWidgetCache = new LruCache<string>(100)  // 있는 경우
export function myNewWidgetHelper() { ... }  // helper가 있는 경우
```

### 체크리스트

- [ ] `WidgetType` 확장
- [ ] `toDOM()`, `eq()`, `ignoreEvent()` 구현
- [ ] innerHTML 사용 시 sanitize 함수 적용
- [ ] 고비용 렌더링인 경우 LRU 캐시 추가
- [ ] `buildDecorations.ts`에 decoration 로직 추가
- [ ] 적절한 reveal logic 선택 (`revealBlock` or `revealInline`)
- [ ] 외부 의존성은 constructor injection 사용
- [ ] `eq()` 메서드에서 모든 필드 비교
- [ ] 동적 높이 변경 시 `scheduleEditorMeasure()` 호출
- [ ] 비동기 렌더링인 경우 token 기반 stale render 방지

## Widget 구현 레퍼런스

### ImageWidget — 이미지 렌더링

**특징:**

- DI 패턴: `markdownFilePath`를 생성자로 주입받음
- 동적 높이: `load`/`error` 이벤트에서 `scheduleEditorMeasure()` 호출
- 경로 해석: `resolveImageSrcForDisplay()` 유틸리티 사용

```typescript
export class ImageWidget extends WidgetType {
  constructor(
    private url: string,
    private alt: string,
    private markdownFilePath: string | null // DI
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const img = document.createElement('img')
    img.alt = this.alt
    img.src = resolveImageSrcForDisplay(this.url, this.markdownFilePath)

    // Measure after load
    const syncLayout = () => scheduleEditorMeasure(view)
    img.addEventListener('load', syncLayout, { once: true })
    img.addEventListener('error', syncLayout, { once: true })

    return wrapper
  }
}
```

### InlineMathWidget / BlockMathWidget — KaTeX 수식

**특징:**

- 200-entry 공유 LRU 캐시 (`wysiwygKatexCache`)
- 캐시 키: `i:${content}` (inline) / `b:${content}` (block)
- Sanitization: `sanitizeKatexHtml()`

```typescript
export const wysiwygKatexCache = new LruCache<string>(200)

export class InlineMathWidget extends WidgetType {
  toDOM() {
    const cacheKey = `i:${this.content}`
    let html = wysiwygKatexCache.get(cacheKey)

    if (html === undefined) {
      html = sanitizeKatexHtml(katex.renderToString(this.content, { throwOnError: false }))
      wysiwygKatexCache.set(cacheKey, html)
    }

    span.innerHTML = html
    return span
  }
}
```

### CodeBlockWidget — Prism.js 구문 강조

**특징:**

- 두 가지 모드:
  - Cursor outside: widget replacement (전체 블록)
  - Cursor inside: fences 숨김 + mark decorations (편집 가능)
- 팔레트: `getCodeBlockPalette()` — 테마별 색상 반환
- LanguageBadgeWidget: 언어 이름 배지

**Cursor Outside Mode:**

```typescript
export class CodeBlockWidget extends WidgetType {
  toDOM() {
    const grammar = Prism.languages[this.language]
    if (grammar) {
      codeEl.innerHTML = sanitizeCodeHtml(Prism.highlight(this.code, grammar, this.language))
    }
    return wrapper
  }
}
```

**Cursor Inside Mode (buildDecorations.ts):**

```typescript
if (revealBlock) {
  // Hide fences
  decorations.push(Decoration.replace({}).range(firstLine.from, firstLine.to + 1))
  decorations.push(Decoration.replace({}).range(lastLine.from - 1, lastLine.to))

  // Apply background to code lines
  for (let i = startLine.number; i <= endLine.number; i++) {
    decorations.push(Decoration.line({ attributes: { style: ... } }).range(line.from))
  }

  // Apply Prism tokens as mark decorations
  const tokens = Prism.tokenize(code, grammar)
  applyPrismTokens(decorations, tokens, codeFrom, palette)
}
```

### MermaidWidget — 다이어그램 렌더링

**특징:**

- 비동기 lazy loading: `getMermaid()` — 첫 사용 시에만 모듈 로드
- 50-entry LRU 캐시 (`mermaidSvgCache`)
- Token 기반 stale render 방지
- 에러 시 fallback: 코드 블록으로 표시

```typescript
const mermaidSvgCache = new LruCache<string>(50)
let mermaidRenderToken = 0

async function renderMermaidInto(container, code, securityLevel, onRendered) {
  const cacheKey = `${code}:${theme}:${securityLevel}`
  const cached = mermaidSvgCache.get(cacheKey)
  if (cached !== undefined) {
    container.innerHTML = cached
    onRendered?.()
    return
  }

  const token = `${++mermaidRenderToken}`
  container.dataset.mermaidToken = token

  try {
    const { svg } = await mermaid.render(id, code)

    // Stale check
    if (!container.isConnected || container.dataset.mermaidToken !== token) return

    const sanitized = sanitizeSvgHtml(svg)
    mermaidSvgCache.set(cacheKey, sanitized)
    container.innerHTML = sanitized
    onRendered?.()
  } catch {
    // Fallback to code block
  }
}

export class MermaidWidget extends WidgetType {
  toDOM(view: EditorView) {
    const panel = document.createElement('div')
    panel.textContent = 'Rendering Mermaid diagram...'

    void renderMermaidInto(panel, this.code, this.securityLevel, () => {
      scheduleEditorMeasure(view) // Re-measure after async render
    })

    return wrapper
  }
}
```

### BulletWidget — 불릿 리스트 마커

**특징:**

- 테마별 색상: `getComputedStyle()` + CSS 변수
- 가장 단순한 widget 예시

```typescript
export class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement('span')
    bullet.textContent = '•'
    bullet.className = 'cm-bullet-widget'

    // Theme-aware color
    const color = getComputedStyle(document.documentElement).getPropertyValue('--c-wys-bullet-text')
    bullet.style.color = `rgb(${color} / 1)`

    return bullet
  }
}
```

### TableWidget — 테이블 렌더링

**특징:**

- 마크다운 테이블을 HTML `<table>` 요소로 변환
- 정규식 기반 파싱

```typescript
export class TableWidget extends WidgetType {
  toDOM() {
    const lines = this.tableText.trim().split('\n')
    const table = document.createElement('table')

    // Parse header row
    const headerRow = lines[0]!.split('|').filter(Boolean)
    const thead = document.createElement('thead')
    // ...

    // Parse body rows
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i]!.split('|').filter(Boolean)
      // ...
    }

    return table
  }
}
```

## 성능 특성

### 문서 크기별 렌더링 시간 (LRU 캐시 히트 시)

```
100 lines:   ~2ms  (트리 순회 1ms + decoration 조립 1ms)
500 lines:   ~8ms  (트리 순회 5ms + decoration 조립 3ms)
1000 lines:  ~15ms (트리 순회 10ms + decoration 조립 5ms)
5000 lines:  ~70ms (트리 순회 50ms + decoration 조립 20ms)
```

### 캐시 미스 시 렌더링 시간 (첫 렌더링)

```
KaTeX 수식:        5-20ms per formula
Mermaid 다이어그램: 50-200ms per diagram
Prism.js 코드블록: 1-5ms per block
이미지:            0ms (브라우저 비동기 로딩)
```

### 메모리 사용량

```
wysiwygKatexCache (200 entries):    ~1-2MB (HTML 문자열)
mermaidSvgCache (50 entries):       ~5-10MB (SVG 문자열)
Total WYSIWYG overhead:             ~10-15MB
```

## 제한사항 및 알려진 이슈

1. **ensureSyntaxTree 50ms 타임아웃**
   - 매우 큰 문서(10,000+ lines)에서는 구문 트리가 불완전할 수 있음
   - 이 경우 일부 decoration이 누락될 수 있으나, 다음 업데이트에서 복구됨

2. **Full rebuild 전략**
   - 거대한 문서(50,000+ lines)에서는 타이핑 지연 가능
   - 실용적 한계: ~10,000 lines (현재 설계로는 충분)

3. **Mermaid 비동기 렌더링**
   - 복잡한 다이어그램은 렌더링 완료까지 수 초 소요
   - 사용자가 빠르게 편집하면 여러 렌더링이 동시에 진행 (token으로 해결)

4. **캐시 무효화 없음**
   - 테마 변경 시 캐시가 자동으로 클리어되지 않음
   - Mermaid는 테마를 캐시 키에 포함하여 해결
   - KaTeX는 테마 독립적이므로 문제없음

## 참고 자료

- [CodeMirror 6 Documentation — Decorations](https://codemirror.net/docs/ref/#view.Decoration)
- [CodeMirror 6 Documentation — StateField](https://codemirror.net/docs/ref/#state.StateField)
- [KaTeX Documentation](https://katex.org/docs/api.html)
- [Mermaid Documentation](https://mermaid.js.org/)
- [Prism.js Documentation](https://prismjs.com/)
- BoltDown 프로젝트 메모리: `/Users/hanyul/.claude/projects/-Users-hanyul-Works-AiScream-MDViewer/memory/MEMORY.md`
