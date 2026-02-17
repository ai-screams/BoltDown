# CodeMirror 6 패턴 가이드 (BoltDown)

이 문서는 BoltDown 프로젝트에서 사용하는 CodeMirror 6의 핵심 패턴을 설명합니다. 모든 코드 예제는 실제 소스 파일에서 가져왔습니다.

---

## 1. Compartment 패턴 — 동적 확장 재구성

### 개념

Compartment는 에디터를 재생성하지 않고도 런타임에 확장(extension)을 동적으로 교체할 수 있게 해주는 패턴입니다. 설정 변경(테마, 폰트 크기, 줄 번호 표시 등)이 있을 때 전체 에디터를 새로 만들지 않고 특정 부분만 업데이트합니다.

### 구현 패턴

**1단계: Compartment 인스턴스 생성 (useRef)**

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 61-66)
// Instance-level compartments (not module-level singletons)
const themeCompRef = useRef(new Compartment())
const wysiwygCompRef = useRef(new Compartment())
const gutterCompRef = useRef(new Compartment())
const focusCompRef = useRef(new Compartment())
const spellcheckCompRef = useRef(new Compartment())
const typewriterCompRef = useRef(new Compartment())
```

**핵심**: Compartment는 컴포넌트 인스턴스별로 생성합니다. 모듈 레벨 싱글톤으로 만들면 여러 에디터 인스턴스가 간섭할 수 있습니다.

**2단계: 초기 확장 배열 구성**

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 110-139)
const buildExtensions = (): Extension[] => [
  markdownExtension(),
  themeCompRef.current.of(isDark ? boltdownDarkTheme : boltdownTheme),
  wysiwygCompRef.current.of(
    mode === 'zen' && cachedWysiwygFn ? cachedWysiwygFn(mermaidSecurityLevel) : []
  ),
  gutterCompRef.current.of(buildGutterExts(mode !== 'zen')),
  focusCompRef.current.of(focusMode ? focusExtension(focusContextLines) : []),
  spellcheckCompRef.current.of(
    EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
  ),
  typewriterCompRef.current.of(typewriterMode ? typewriterExtension() : []),
  history(),
  search(),
  // ... more extensions
]
```

**3단계: 동적 재구성 (dispatch + reconfigure)**

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 93-107)
const buildReconfigureEffects = useCallback(
  () => [
    themeCompRef.current.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme),
    wysiwygCompRef.current.reconfigure(
      mode === 'zen' && cachedWysiwygFn ? cachedWysiwygFn(mermaidSecurityLevel) : []
    ),
    gutterCompRef.current.reconfigure(buildGutterExts(mode !== 'zen')),
    focusCompRef.current.reconfigure(focusMode ? focusExtension(focusContextLines) : []),
    spellcheckCompRef.current.reconfigure(
      EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
    ),
    typewriterCompRef.current.reconfigure(typewriterMode ? typewriterExtension() : []),
  ],
  [focusContextLines, focusMode, isDark, mermaidSecurityLevel, mode, spellcheck, typewriterMode]
)

// Apply reconfiguration (lines 284-289)
useEffect(() => {
  const view = viewRef.current
  if (!view) return
  view.dispatch({ effects: buildReconfigureEffects() })
}, [buildReconfigureEffects])
```

### 왜 Compartment를 사용하는가?

- **성능**: 에디터를 재생성하면 DOM이 다시 그려지고 스크롤 위치, 커서, 실행 취소 기록이 모두 초기화됩니다.
- **사용자 경험**: 설정 변경 시 깜박임 없이 부드럽게 업데이트됩니다.
- **선택적 업데이트**: 변경된 Compartment만 재구성하면 되므로 효율적입니다.

---

## 2. StateField with Decorations — WYSIWYG 렌더링

### 개념

StateField는 에디터 상태와 동기화되는 커스텀 데이터를 저장합니다. Decoration(장식)은 에디터의 시각적 표현을 변경하는 방법입니다 (텍스트 숨기기, 위젯 삽입, 스타일 적용 등).

### StateField vs ViewPlugin

- **StateField**: 에디터 상태의 일부. `create()` + `update()`로 동기화. Decoration 관리에 적합.
- **ViewPlugin**: View 레벨의 부수 효과. DOM 이벤트 리스너, 측정(measure) 등에 사용.

### 구현: WYSIWYG 확장

```typescript
// src/components/editor/extensions/wysiwyg/index.ts (lines 8-30)
export function wysiwygExtension(mermaidSecurityLevel: MermaidSecurityLevel = 'strict') {
  const wysiwygDecorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, mermaidSecurityLevel)
    },
    update(decorations, tr) {
      // No changes at all: reuse existing decorations
      if (!tr.docChanged && !tr.selection) return decorations

      // Full rebuild on any doc or selection change.
      // The LRU caches for KaTeX (wysiwygKatexCache) and Mermaid (mermaidSvgCache)
      // make each rebuild cheap — the expensive rendering is served from cache,
      // so only the tree walk and decoration assembly cost remains.
      return buildDecorations(tr.state, mermaidSecurityLevel)
    },
    provide: field => EditorView.decorations.from(field),
  })

  return wysiwygDecorations
}
```

### Decoration 빌딩 (재빌드 조건)

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (lines 47-56)
export function buildDecorations(
  state: EditorState,
  mermaidSecurityLevel: MermaidSecurityLevel
): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main
  const cursorLine = state.doc.lineAt(cursor.head).number
  const codeRanges: DocRange[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state)
  // ...
```

**핵심 요구사항**: `Range<Decoration>[]` 배열은 **정렬된 상태**여야 합니다 (`from` 기준 오름차순). 이것이 CodeMirror 6의 내부 요구사항입니다.

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (line 383)
return Decoration.set(decorations, true) // true = 이미 정렬됨
```

### Decoration 종류

**1. Decoration.replace — 텍스트 숨기기 또는 위젯으로 교체**

```typescript
// 헤딩 마커(# ) 숨기기 (lines 86)
decorations.push(Decoration.replace({}).range(from, from + hashLen + 1))

// 이미지 위젯으로 교체 (lines 128-133)
decorations.push(
  Decoration.replace({
    widget: new ImageWidget(url, alt, markdownFilePath),
  }).range(from, to)
)
```

**2. Decoration.mark — 텍스트에 스타일 적용**

```typescript
// 굵은 텍스트 (line 98)
applyInlineFormatting(decorations, from, to, 2, 'font-weight: 700;', revealInline)

// 내부 구현 (lines 32-33)
decorations.push(
  Decoration.mark({ attributes: { style: contentStyle } }).range(from + markerLen, to - markerLen)
)
```

**3. Decoration.line — 전체 줄에 스타일 적용**

```typescript
// 헤딩 줄 스타일 (lines 88-92)
decorations.push(
  Decoration.line({
    attributes: { style: headingStyles[level] ?? '' },
  }).range(state.doc.lineAt(from).from)
)
```

**4. Decoration.widget — 위치에 위젯 삽입**

```typescript
// 언어 배지 위젯 (lines 367-372)
decorations.push(
  Decoration.widget({
    widget: new LanguageBadgeWidget(language),
    side: -1, // -1 = 커서 앞에 삽입
  }).range(codeTextNode[0]!.from)
)
```

---

## 3. WidgetType 패턴 — 커스텀 인라인 위젯

### 개념

WidgetType은 에디터에 커스텀 DOM 요소를 삽입하는 방법입니다. 이미지, 수식, 다이어그램 등 일반 텍스트로 표현할 수 없는 요소를 렌더링합니다.

### 라이프사이클 메서드

```typescript
// src/components/editor/extensions/wysiwyg/ImageWidget.ts
export class ImageWidget extends WidgetType {
  constructor(
    private url: string,
    private alt: string,
    private markdownFilePath: string | null
  ) {
    super()
  }

  // 1. toDOM() — 위젯의 DOM 생성 (필수)
  toDOM(view: EditorView) {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-image-widget'
    // ... DOM 구성
    return wrapper
  }

  // 2. eq() — 동등성 검사 (성능 최적화의 핵심)
  eq(other: ImageWidget) {
    return (
      this.url === other.url &&
      this.alt === other.alt &&
      this.markdownFilePath === other.markdownFilePath
    )
  }

  // 3. ignoreEvent() — 이벤트 전파 제어
  ignoreEvent() {
    return false // 에디터가 이벤트 처리하도록 함
  }

  // 4. updateDOM() — 선택적, DOM 업데이트 최적화
  // (이 프로젝트에서는 사용하지 않음)
}
```

### eq() 메서드의 중요성

CodeMirror는 decoration이 재빌드될 때마다 `eq()`를 호출해서 위젯이 실제로 변경되었는지 확인합니다. `eq()`가 `true`를 반환하면 **DOM을 재생성하지 않고** 기존 DOM을 재사용합니다.

**나쁜 예** (항상 재생성):

```typescript
eq(other: ImageWidget) {
  return false // 매번 DOM 재생성!
}
```

**좋은 예** (실제 변경시만 재생성):

```typescript
eq(other: ImageWidget) {
  return this.url === other.url && this.alt === other.alt
}
```

### DI 패턴 (Dependency Injection)

ImageWidget은 `markdownFilePath`를 생성자로 받습니다. 이것은 `toDOM()` 안에서 store에 직접 접근하는 것보다 나은 패턴입니다.

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (lines 58-61)
// Q11 fix: read markdownFilePath once here instead of inside ImageWidget.toDOM()
const { tabs, activeTabId } = useTabStore.getState()
const activeTab = tabs.find(t => t.id === activeTabId)
const markdownFilePath = activeTab?.filePath ?? null
```

**왜 이렇게 하나요?**

- `toDOM()`이 여러 번 호출될 때마다 store를 읽지 않습니다.
- 위젯이 순수 함수처럼 동작합니다 (같은 입력 → 같은 출력).
- `eq()` 검사가 정확해집니다.

### 성능 최적화: LRU 캐시

```typescript
// src/components/editor/extensions/wysiwyg/InlineMathWidget.ts (lines 7, 16-26)
export const wysiwygKatexCache = new LruCache<string>(200)

export class InlineMathWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-inline-math-widget'
    const cacheKey = `i:${this.content}`
    let html = wysiwygKatexCache.get(cacheKey)
    if (html === undefined) {
      html = sanitizeKatexHtml(
        katex.renderToString(this.content, {
          throwOnError: false,
          strict: 'ignore',
        })
      )
      wysiwygKatexCache.set(cacheKey, html)
    }
    span.innerHTML = html
    return span
  }
}
```

KaTeX 렌더링은 비용이 크므로 결과를 캐싱합니다. 이로 인해 StateField의 전체 재빌드가 저렴해집니다.

---

## 4. Two-Tier Reveal 시스템 — WYSIWYG 콘텐츠 편집

### 개념

WYSIWYG 모드에서 마크다운 구문을 숨기되, 커서가 해당 위치에 있을 때는 구문을 드러내야 사용자가 편집할 수 있습니다. BoltDown은 2단계 reveal 시스템을 사용합니다.

### revealBlock vs revealInline

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (lines 63-69)
tree.iterate({
  enter(node) {
    const { from, to } = node
    const cursorInRange = isSelectionInRange(cursor, from, to)
    const cursorOnNodeLine = isCursorOnRangeLine(state, cursorLine, from, to)
    const revealBlock = cursorInRange || cursorOnNodeLine
    const revealInline = cursorInRange
```

**revealBlock** (블록 레벨 요소):

- 조건: 커서가 노드 범위 안에 **또는** 같은 줄에 있음
- 적용 대상: 헤딩, 코드 블록, 테이블, 이미지, 수평선
- 이유: 블록 요소는 여러 줄을 차지할 수 있으므로 같은 줄에만 있어도 드러냅니다.

**revealInline** (인라인 요소):

- 조건: 커서가 노드 범위 안에만
- 적용 대상: 굵게, 이탤릭, 인라인 코드, 링크, 취소선
- 이유: 인라인 요소는 정확한 커서 위치에서만 구문을 보여줘야 합니다.

### 실제 적용 예시

**블록 요소 — 헤딩**:

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (lines 77-94)
if (node.name.startsWith('ATXHeading') && !revealBlock) {
  const levelMatch = /ATXHeading(\d)/.exec(node.name)
  const level = levelMatch?.[1] ?? '1'
  const lineText = state.sliceDoc(from, to)
  const hashMatch = /^(#{1,6})\s/.exec(lineText)

  if (hashMatch) {
    const hashLen = hashMatch[1]!.length
    // Hide the # marks
    decorations.push(Decoration.replace({}).range(from, from + hashLen + 1))
    // Style the heading
    decorations.push(
      Decoration.line({
        attributes: { style: headingStyles[level] ?? '' },
      }).range(state.doc.lineAt(from).from)
    )
  }
}
```

커서가 헤딩 줄 밖에 있을 때만 (`!revealBlock`) `#` 마커를 숨기고 스타일을 적용합니다.

**인라인 요소 — 링크**:

```typescript
// src/components/editor/extensions/wysiwyg/buildDecorations.ts (lines 163-203)
if (node.name === 'Link') {
  // ... link parsing ...

  // Always style link text with blue + underline
  decorations.push(
    Decoration.mark({
      attributes: {
        style:
          'color: rgb(var(--c-wys-link-text) / 1); text-decoration: underline; cursor: pointer;',
      },
    }).range(openBracket.to, closeBracket.from)
  )

  if (!revealInline) {
    // Cursor outside: hide markers
    decorations.push(Decoration.replace({}).range(openBracket.from, openBracket.to))
    decorations.push(Decoration.replace({}).range(closeBracket.from, closeParen.to))
  } else {
    // Cursor inside: show markers dimmed
    decorations.push(
      Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(
        openBracket.from,
        openBracket.to
      )
    )
    // ...
  }
}
```

링크 텍스트는 항상 파란색+밑줄이지만, 마커(`[`, `]`, `(`, `)`)는 커서가 링크 안에 있을 때만 (`revealInline`) 흐리게 보입니다.

### 유틸리티 함수

```typescript
// src/components/editor/extensions/wysiwyg/utils.ts (lines 36-46)
export function isSelectionInRange(
  selection: { from: number; to: number },
  from: number,
  to: number
) {
  if (selection.from === selection.to) {
    return selection.from >= from && selection.from < to
  }

  return selection.from < to && selection.to > from
}

// lines 48-57
export function isCursorOnRangeLine(
  state: EditorState,
  cursorLine: number,
  from: number,
  to: number
) {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return cursorLine >= startLine && cursorLine <= endLine
}
```

---

## 5. Tab State Management — 탭 간 에디터 상태 보존

### 문제

사용자가 여러 파일을 열어놓고 탭을 전환할 때, 각 탭의 스크롤 위치, 커서 위치, 실행 취소 기록이 보존되어야 합니다. 에디터를 매번 재생성하면 이 모든 것이 초기화됩니다.

### 해결: EditorState 직렬화 + 캐싱

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 56-58)
const viewRef = useRef<EditorView | null>(null)
const stateCacheRef = useRef(new Map<string, EditorState>())
const prevTabIdRef = useRef<string | null>(null)
```

### 탭 전환 시 상태 저장/복원

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 239-269)
useEffect(() => {
  const view = viewRef.current
  if (!view || prevTabIdRef.current === activeTabId) return

  // Save current tab's EditorState (includes undo history, cursor, scroll)
  if (prevTabIdRef.current) {
    stateCacheRef.current.set(prevTabIdRef.current, view.state)
  }

  // Restore cached state or create fresh for new tab
  const cached = stateCacheRef.current.get(activeTabId)
  if (cached) {
    view.setState(cached)
    // Re-apply current compartment configs after restore
    view.dispatch({
      effects: buildReconfigureEffects(),
    })
  } else {
    const activeTab = useTabStore.getState().tabs.find(t => t.id === activeTabId)
    view.setState(
      EditorState.create({
        doc: activeTab?.content ?? '',
        extensions: buildExtensions(),
      })
    )
  }

  prevTabIdRef.current = activeTabId
}, [activeTabId])
```

**핵심 단계**:

1. 이전 탭의 `EditorState`를 `stateCacheRef`에 저장
2. 새 탭의 캐시된 상태가 있으면 `view.setState()`로 복원
3. 복원 후 현재 Compartment 설정을 재적용 (`buildReconfigureEffects()`)
4. 캐시가 없으면 새 상태 생성

### 탭 닫힐 때 캐시 정리

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 271-282)
useEffect(() => {
  const unsub = useTabStore.subscribe((state, prev) => {
    if (state.tabs.length < prev.tabs.length) {
      const currentIds = new Set(state.tabs.map(t => t.id))
      for (const key of stateCacheRef.current.keys()) {
        if (!currentIds.has(key)) stateCacheRef.current.delete(key)
      }
    }
  })
  return unsub
}, [])
```

메모리 누수를 방지하기 위해 닫힌 탭의 상태를 제거합니다.

### 왜 EditorState를 직렬화하지 않나요?

CodeMirror 6는 `EditorState.toJSON()` / `EditorState.fromJSON()`을 제공하지만, 이 프로젝트는 메모리에 직접 저장합니다.

**이유**:

- **성능**: JSON 직렬화/역직렬화는 큰 문서에서 느립니다.
- **완전성**: Extension 객체는 JSON으로 직렬화할 수 없으므로 별도로 재구성해야 합니다.
- **단순성**: 메모리 참조가 더 직관적입니다.

---

## 6. View Dispatch 패턴 — 프로그래매틱 에디터 업데이트

### 개념

`view.dispatch()`는 에디터 상태를 변경하는 **유일한** 방법입니다. 트랜잭션(transaction)을 통해 변경 사항을 원자적으로 적용합니다.

### 패턴 1: Compartment 재구성

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 77-79)
view.dispatch({
  effects: wysiwygCompRef.current.reconfigure(mod.wysiwygExtension(mermaidSecurityLevel)),
})
```

### 패턴 2: 텍스트 변경 (Find & Replace)

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 1-9)
import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search'
```

**SearchQuery 생성**:

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 186-198)
const buildQuery = useCallback(
  (search: string, replace?: string) => {
    const finalReplace = replace ?? useFindReplaceStore.getState().replaceText
    return new SearchQuery({
      search,
      caseSensitive,
      regexp: useRegex,
      wholeWord,
      replace: finalReplace,
    })
  },
  [caseSensitive, useRegex, wholeWord]
)
```

**검색 쿼리 설정**:

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 227-228)
const query = buildQuery(searchText)
view.dispatch({ effects: setSearchQuery.of(query) })
```

**다음 찾기/이전 찾기**:

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 346-358)
const handleFindNext = useCallback(() => {
  const view = editorViewRef.current
  if (!view || matches.length === 0) return
  findNext(view)
  syncIndexFromCursor(view)
}, [editorViewRef, matches.length, syncIndexFromCursor])

const handleFindPrev = useCallback(() => {
  const view = editorViewRef.current
  if (!view || matches.length === 0) return
  findPrevious(view)
  syncIndexFromCursor(view)
}, [editorViewRef, matches.length, syncIndexFromCursor])
```

**치환**:

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 361-372)
const handleReplace = useCallback(() => {
  const view = editorViewRef.current
  if (!view) return
  try {
    replaceNext(view)
    setDocVersion(v => v + 1)
  } catch (e) {
    const message = e instanceof Error ? e.message : FIND_REPLACE_ERRORS.replaceFailed
    console.error('Replace failed:', e)
    setRegexError(message)
  }
}, [editorViewRef])
```

### 패턴 3: 선택 영역 변경

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 422-431)
const handleJumpTo = useCallback(
  (match: MatchInfo, index: number) => {
    const view = editorViewRef.current
    if (!view) return
    view.dispatch({
      selection: { anchor: match.from, head: match.to },
      effects: EditorView.scrollIntoView(EditorSelection.cursor(match.from), { y: 'center' }),
    })
    setCurrentIndex(index)
  },
  [editorViewRef]
)
```

**핵심**: `selection`과 `effects`를 한 번의 `dispatch()` 호출에 함께 전달해서 원자적으로 적용합니다.

### 패턴 4: 문서 변경 감지

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 134-138)
EditorView.updateListener.of(update => {
  if (update.docChanged) {
    updateContent(activeTabIdRef.current, update.state.doc.toString())
  }
})
```

`updateListener`를 사용해서 문서가 변경될 때마다 Zustand store에 동기화합니다.

### 패턴 5: Compartment를 사용한 리스너 동적 추가/제거

```typescript
// src/components/findreplace/FindReplaceModal.tsx (lines 175-176, 258-286)
const listenerCompartmentRef = useRef(new Compartment())
const listenerViewRef = useRef<EditorView | null>(null)

useEffect(() => {
  if (!isOpen) return
  const view = editorViewRef.current
  if (!view) return
  const listenerCompartment = listenerCompartmentRef.current

  if (listenerViewRef.current !== view) {
    view.dispatch({
      effects: StateEffect.appendConfig.of(listenerCompartment.of([])),
    })
    listenerViewRef.current = view
  }

  view.dispatch({
    effects: listenerCompartment.reconfigure(
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          setDocVersion(v => v + 1)
        }
      })
    ),
  })

  return () => {
    if (listenerViewRef.current === view) {
      view.dispatch({ effects: listenerCompartment.reconfigure([]) })
    }
  }
}, [isOpen, editorViewRef])
```

Find & Replace 모달이 열려있을 때만 문서 변경을 추적합니다. 모달이 닫히면 리스너를 제거해서 메모리와 성능을 절약합니다.

---

## 7. 기타 유용한 패턴

### EditorView 접근 패턴 (Context)

```typescript
// src/hooks/useDocumentStats.ts (lines 1-33)
import { useEffect, useState } from 'react'
import { useTabStore } from '@/stores/tabStore'

export function useDocumentStats(debounceMs = DOCUMENT_STATS_POLICY.debounceMs): DocumentStats {
  const content = useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.content ?? ''
  })
  const [stats, setStats] = useState<DocumentStats>(EMPTY_STATS)

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        chars: content.length,
        words: content.split(/\s+/).filter(Boolean).length,
        lines: content.split('\n').length,
      })
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [content, debounceMs])

  return stats
}
```

이 프로젝트는 EditorView에 직접 접근하지 않고 **Zustand store의 content를 구독**합니다. 더 React스러운 패턴입니다.

다른 컴포넌트에서 EditorView에 접근해야 할 때는 Context를 사용합니다:

```typescript
// src/contexts/EditorViewContext.tsx (사용 예)
const editorViewRef = useEditorView()
const view = editorViewRef.current
if (view) {
  // view 사용
}
```

### Lazy Loading Extension

```typescript
// src/components/editor/MarkdownEditor.tsx (lines 33-34, 70-82)
// Module-level cache for lazy-loaded wysiwyg extension
let cachedWysiwygFn: ((level: MermaidSecurityLevel) => Extension) | null = null

useEffect(() => {
  if (mode !== 'zen' || cachedWysiwygFn) return
  void import('./extensions/wysiwyg').then(mod => {
    cachedWysiwygFn = mod.wysiwygExtension
    const view = viewRef.current
    if (view) {
      view.dispatch({
        effects: wysiwygCompRef.current.reconfigure(mod.wysiwygExtension(mermaidSecurityLevel)),
      })
    }
  })
}, [mode, mermaidSecurityLevel])
```

WYSIWYG 확장은 Zen 모드가 처음 활성화될 때만 동적으로 로드됩니다. 이렇게 하면 초기 번들 크기가 줄어듭니다.

**핵심**: 모듈 레벨 캐시 (`cachedWysiwygFn`)를 사용해서 한 번만 로드합니다.

---

## 핵심 교훈

### 1. Compartment는 에디터 재생성을 방지합니다

설정이 자주 변경되는 경우 (테마, 폰트, 모드 전환), Compartment를 사용하면 사용자 경험이 크게 향상됩니다.

### 2. StateField 재빌드는 생각보다 저렴할 수 있습니다

BoltDown은 모든 문서/선택 변경 시 decoration을 전체 재빌드하지만, LRU 캐시 덕분에 성능 문제가 없습니다. 점진적 업데이트는 복잡도를 크게 증가시키므로 먼저 측정해보고 결정하세요.

### 3. WidgetType.eq()는 성능의 핵심입니다

`eq()`가 제대로 구현되지 않으면 매번 DOM이 재생성되어 깜박임과 성능 저하가 발생합니다.

### 4. Two-tier reveal은 사용자 경험을 세밀하게 제어합니다

블록 요소와 인라인 요소는 reveal 조건이 다릅니다. `revealBlock`과 `revealInline`을 분리하면 직관적인 편집 경험을 만들 수 있습니다.

### 5. EditorState 캐싱은 탭 전환을 부드럽게 만듭니다

에디터를 재생성하지 않고 `setState()`로 상태를 교체하면 모든 것(스크롤, 커서, 실행 취소 기록)이 보존됩니다.

### 6. view.dispatch()는 원자적입니다

여러 변경 사항을 한 번의 dispatch에 담아서 실행 취소/다시 실행이 자연스럽게 동작하도록 하세요.

### 7. Compartment로 리스너를 동적으로 제어하세요

항상 켜져있을 필요가 없는 리스너는 Compartment로 감싸서 필요할 때만 활성화하면 메모리와 성능을 절약할 수 있습니다.

### 8. Lazy loading으로 초기 번들 크기를 줄이세요

자주 사용되지 않는 확장(WYSIWYG, Mermaid 등)은 동적 import로 로드하되, 모듈 레벨 캐시로 중복 로딩을 방지하세요.

---

## 참고 자료

- [CodeMirror 6 공식 문서](https://codemirror.net/docs/)
- [CodeMirror 6 예제 모음](https://codemirror.net/examples/)
- BoltDown 소스 코드:
  - `src/components/editor/MarkdownEditor.tsx` — Compartment 패턴, 탭 관리
  - `src/components/editor/extensions/wysiwyg/` — StateField, Decoration, WidgetType
  - `src/components/findreplace/FindReplaceModal.tsx` — SearchQuery, dispatch 패턴
