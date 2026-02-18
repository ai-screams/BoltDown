# Zustand State Management Patterns

BoltDown 프로젝트에서 사용하는 Zustand 패턴과 안티패턴을 실제 코드 예제와 함께 설명합니다.

## 목차

1. [Selector 최적화](#1-selector-최적화)
2. [Stale Closure 방지](#2-stale-closure-방지)
3. [Module-Level Helper 패턴](#3-module-level-helper-패턴)
4. [Atomic State Updates](#4-atomic-state-updates)
5. [Persist Middleware](#5-persist-middleware)
6. [Runtime Type Guard 패턴](#6-runtime-type-guard-패턴)
7. [Derived State](#7-derived-state)
8. [Transient Notifications](#8-transient-notifications)
9. [핵심 교훈](#핵심-교훈)

---

## 1. Selector 최적화

Zustand는 기본적으로 `Object.is`로 selector 반환값을 비교합니다. 객체를 반환하면 매번 새 참조가 생성되어 불필요한 리렌더링이 발생합니다.

### ✅ 좋은 패턴: Primitive 반환

```tsx
// Footer.tsx
const statusText = useEditorStore(s => s.statusText)
```

Primitive 값(`string`, `number`, `boolean`)은 `Object.is` 비교가 정확하게 동작합니다.

### ✅ 좋은 패턴: Derived Primitive

고빈도 UI(Footer, 상태 표시줄)에서는 객체를 파고들어 primitive를 직접 추출합니다:

```tsx
// useDocumentStats.ts
const content = useTabStore(s => {
  const tab = s.tabs.find(t => t.id === s.activeTabId)
  return tab?.content ?? ''
})
```

이 패턴은 `content` 문자열만 비교하므로 탭 배열 자체가 변경되어도 내용이 같으면 리렌더링이 발생하지 않습니다.

### ❌ 안티패턴: 객체 반환

```tsx
// ❌ 매 렌더링마다 새 객체 생성 → 항상 리렌더링
const { mode, fileName } = useEditorStore(s => ({
  mode: s.mode,
  fileName: s.fileName,
}))
```

이 코드는 `{ mode: 'split', fileName: 'doc.md' }`가 매번 새로운 객체 참조로 생성되어 `Object.is` 비교가 항상 `false`를 반환합니다.

### ⚠️ Zustand v4.5+ useShallow 사용법

객체를 반환해야 하는 경우 `zustand/react/shallow`의 `useShallow`를 사용:

```tsx
import { useShallow } from 'zustand/react/shallow'

// ✅ Shallow 비교로 불필요한 리렌더링 방지
const { mode, fileName } = useEditorStore(useShallow(s => ({ mode: s.mode, fileName: s.fileName })))
```

**주의**: v4.5 이전에는 `import { shallow } from 'zustand/shallow'`였으나 v4.5+에서는 `zustand/react/shallow`로 변경되었습니다.

---

## 2. Stale Closure 방지

React의 `useState`와 달리 Zustand는 store 외부에서 `getState()`로 최신 상태를 읽을 수 있습니다.

### 문제: 비동기 함수 내 Stale Closure

```tsx
// ❌ 렌더링 시점의 값이 캡처됨
const activeTabId = useTabStore(s => s.activeTabId)
const tabs = useTabStore(s => s.tabs)

setTimeout(() => {
  // 1초 후 실행될 때 activeTabId와 tabs는 이미 오래된 값
  const tab = tabs.find(t => t.id === activeTabId)
}, 1000)
```

### ✅ 해결책: `getState()` 사용

```tsx
// useAutoSave.ts (실제 코드)
const saveDirtyTabs = async () => {
  isSavingRef.current = true

  try {
    const tabs = useTabStore.getState().tabs // ✅ 최신 상태 읽기
    const { markClean } = useTabStore.getState()

    for (const tab of tabs) {
      if (tab.content === tab.savedContent) continue

      // ✅ 비동기 작업 중 탭이 닫혔을 수 있으므로 재확인
      const current = useTabStore.getState().tabs.find(t => t.id === tab.id)
      if (!current) continue

      if (current.filePath && desktop) {
        await invokeTauri('write_file', {
          path: current.filePath,
          content: current.content,
        })
        markClean(current.id, current.content)
      }
    }
  } finally {
    isSavingRef.current = false
  }
}
```

이 패턴은 다음 상황에서 필수적입니다:

1. **비동기 함수** (`setTimeout`, `Promise`, `async/await`)
2. **이벤트 핸들러** (렌더링 시점과 실행 시점이 다른 경우)
3. **Effect cleanup** (컴포넌트가 이미 unmount되었을 수 있음)

### 추가 예제: useFileSystem

```tsx
// useFileSystem.ts
const openFile = useCallback(async () => {
  const text = await invokeTauri<string>('read_file', { path })
  openTab(path, name, text)

  // ✅ 비동기 작업 후 최신 sidebar 상태 읽기
  const sidebarState = useSidebarStore.getState()
  await sidebarState.loadParentDirectory(path, sidebarState.isOpen)
}, [openTab, addRecentFile])
```

---

## 3. Module-Level Helper 패턴

Store 외부에 pure function을 추출하면 테스트 가능성과 재사용성이 높아집니다.

### 패턴: settingsStore의 Module-Level Helpers

```tsx
// settingsStore.ts (실제 코드)

// --- Module-level helpers ---

let saveTimer: ReturnType<typeof setTimeout> | null = null
let themeListenerRegistered = false

function debouncedSave(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveSettingsToStorage(settings)
  }, SETTINGS_POLICY.saveDebounceMs) // 500ms
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia(MEDIA_QUERIES.prefersDark).matches ? 'dark' : 'light'
}

function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement
  const resolved = resolveThemeMode(theme.mode)
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = theme.name
  root.dataset.themeMode = theme.mode
  root.dataset.themeResolved = resolved
}

function sanitizeTheme(theme: Partial<ThemeSettings> | undefined): ThemeSettings {
  const mode = THEME_MODES.includes((theme?.mode ?? '') as ThemeMode)
    ? (theme?.mode as ThemeMode)
    : DEFAULT_THEME.mode
  const name =
    typeof theme?.name === 'string' && isBuiltInThemeName(theme.name)
      ? theme.name
      : DEFAULT_THEME.name
  const customCss = typeof theme?.customCss === 'string' ? theme.customCss : DEFAULT_THEME.customCss

  return { mode, name: name as ThemeName, customCss }
}

function mergeWithDefaults(stored: Partial<AppSettings>, defaults: AppSettings): AppSettings {
  return {
    theme: sanitizeTheme({ ...defaults.theme, ...stored.theme }),
    editor: { ...defaults.editor, ...stored.editor },
    preview: { ...defaults.preview, ...stored.preview },
    general: { ...defaults.general, ...stored.general },
  }
}

// --- Store ---

export const useSettingsStore = create<SettingsState>((set, get) => {
  const patchCategory = <K extends SettingsCategory>(
    category: K,
    patch: Partial<AppSettings[K]>
  ): void => {
    const previous = get().settings
    const next =
      category === 'theme'
        ? ({
            ...previous,
            theme: sanitizeTheme({
              ...previous.theme,
              ...(patch as Partial<ThemeSettings>),
            }),
          } as AppSettings)
        : ({
            ...previous,
            [category]: { ...previous[category], ...patch },
          } as AppSettings)

    set({ settings: next })
    if (category === 'theme') applyTheme(next.theme) // ✅ helper 호출
    debouncedSave(next) // ✅ helper 호출
  }

  return {
    updateTheme: patch => patchCategory('theme', patch),
    // ...
  }
})
```

### 왜 이 패턴을 사용하는가?

1. **테스트 용이성**: Pure function은 store 없이 단독 테스트 가능
2. **관심사 분리**: Store는 상태 관리만, 비즈니스 로직은 helper가 담당
3. **재사용성**: 다른 컨텍스트에서도 helper 함수 사용 가능
4. **가독성**: Store 정의가 간결해짐

### sidebarStore의 debounce 패턴

```tsx
// sidebarStore.ts (실제 코드)

// Module-level debounce timer
let widthWriteTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSaveWidth(width: number) {
  if (widthWriteTimer) clearTimeout(widthWriteTimer)
  widthWriteTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(width))
    } catch {
      // Ignore storage errors (private mode/quota exceeded)
    }
  }, SIDEBAR_POLICY.saveDebounceMs) // 300ms
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  setWidth: width => {
    const clamped = Math.max(SIDEBAR_WIDTH_LIMITS.min, Math.min(width, SIDEBAR_WIDTH_LIMITS.max))
    debouncedSaveWidth(clamped) // ✅ 드래그 중 60fps로 호출되지만 300ms마다만 저장
    set({ width: clamped })
  },
}))
```

사이드바 리사이징은 초당 60회 호출되지만 debounce로 localStorage 쓰기는 300ms마다만 발생합니다.

---

## 4. Atomic State Updates

여러 state 필드를 동시에 업데이트해야 할 때는 단일 `set()` 호출로 처리해야 중간 상태가 노출되지 않습니다.

### ❌ 안티패턴: 순차적 set() 호출

```tsx
// ❌ 두 번의 set()으로 중간 상태 노출
set({ rootPath: dir })
// 이 사이에 컴포넌트가 리렌더링되면 rootPath는 업데이트되었지만 treeData는 비어있음
set({ treeData: entries })
```

이렇게 하면 사용자가 잠깐 동안 잘못된 UI를 볼 수 있습니다 (새 경로 + 이전 파일 목록).

### ✅ 올바른 패턴: Atomic Update

```tsx
// sidebarStore.ts (실제 코드)
loadParentDirectory: async (filePath, openSidebar = false) => {
  const dir = getDirectoryPath(filePath)
  if (!dir) return
  const { rootPath } = get()
  if (rootPath !== dir) {
    try {
      const entries = await loadDirectoryEntries(dir)
      set({ rootPath: dir, treeData: entries })  // ✅ 원자적 업데이트
    } catch (error) {
      console.error('Failed to load parent directory:', dir, error)
    }
  }
  if (openSidebar) set({ isOpen: true })
},
```

단일 `set()` 호출로 `rootPath`와 `treeData`가 동시에 업데이트되므로 중간 상태가 절대 노출되지 않습니다.

### 실제 버그 사례 (Wave 8 U3에서 수정됨)

이전 코드는 두 번의 `set()` 호출로 인해 다음과 같은 race condition이 발생했습니다:

1. `set({ rootPath: dir })` 실행
2. 컴포넌트 리렌더링 → 새 경로 + 이전 파일 목록 표시 (깜빡임)
3. `set({ treeData: entries })` 실행
4. 컴포넌트 리렌더링 → 올바른 상태

Atomic update로 수정 후 이 문제가 완전히 사라졌습니다.

---

## 5. Persist Middleware

Zustand의 `persist` middleware를 사용하면 선택적으로 상태를 localStorage에 자동 저장할 수 있습니다.

### 패턴: 선택적 Persistence (findReplaceStore)

```tsx
// findReplaceStore.ts (실제 코드)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useFindReplaceStore = create<FindReplaceState>()(
  persist(
    set => ({
      isOpen: false,
      showReplace: false,
      searchText: '', // ❌ 저장하지 않음
      replaceText: '', // ❌ 저장하지 않음
      caseSensitive: false, // ✅ 저장
      useRegex: false, // ✅ 저장
      wholeWord: false, // ✅ 저장
      searchTruncated: false,
      replaceTruncated: false,

      open: (showReplace = false) => set({ isOpen: true, showReplace }),
      close: () => set({ isOpen: false, searchTruncated: false, replaceTruncated: false }),
      toggleCaseSensitive: () => set(s => ({ caseSensitive: !s.caseSensitive })),
      toggleRegex: () => set(s => ({ useRegex: !s.useRegex })),
      toggleWholeWord: () => set(s => ({ wholeWord: !s.wholeWord })),
      // ...
    }),
    {
      name: STORAGE_KEYS.findReplacePreferences,
      partialize: (state): Pick<FindReplaceState, 'caseSensitive' | 'useRegex' | 'wholeWord'> => ({
        caseSensitive: state.caseSensitive,
        useRegex: state.useRegex,
        wholeWord: state.wholeWord,
      }),
    }
  )
)
```

### 설계 의도

- **저장**: `caseSensitive`, `useRegex`, `wholeWord` — 사용자의 검색 설정
- **저장 안 함**: `searchText`, `replaceText` — 개인정보/보안 (이전 검색어 노출 방지)

`partialize` 함수로 저장할 필드를 명시적으로 선택합니다.

### settingsStore의 수동 Persistence

더 복잡한 경우 `persist` middleware 대신 수동 저장을 사용합니다:

```tsx
// settingsStore.ts
export const useSettingsStore = create<SettingsState>((set, get) => {
  const patchCategory = <K extends SettingsCategory>(
    category: K,
    patch: Partial<AppSettings[K]>
  ): void => {
    const next = {
      /* ... */
    }
    set({ settings: next })
    debouncedSave(next) // ✅ 500ms debounce 후 Tauri appDataDir 또는 localStorage에 저장
  }

  return {
    loadSettings: async () => {
      const stored = await loadSettingsFromStorage() // Tauri primary, localStorage fallback
      if (stored) {
        const merged = mergeWithDefaults(stored, DEFAULT_SETTINGS)
        set({ settings: merged, isLoaded: true })
        applyTheme(merged.theme)
      }
      // ...
    },
  }
})
```

Tauri 앱에서는 `appDataDir`을 우선 사용하고 브라우저에서는 localStorage로 fallback합니다.

---

## 6. Runtime Type Guard 패턴

`JSON.parse()`는 항상 `unknown` 타입을 반환하므로 런타임 검증이 필요합니다.

### 패턴: Type Guard + Filter

```tsx
// sidebarStore.ts (실제 코드)

// ✅ Type guard 함수
const isRecentFile = (v: unknown): v is RecentFile =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as RecentFile).path === 'string' &&
  typeof (v as RecentFile).name === 'string'

const loadRecentFiles = (): RecentFile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentFiles)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw) // ✅ unknown 타입
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isRecentFile) // ✅ 유효한 항목만 필터링
  } catch {
    return []
  }
}
```

### 왜 이 패턴이 필요한가?

1. **localStorage 손상**: 사용자가 수동으로 값을 수정했거나 다른 버전의 앱이 쓴 데이터
2. **타입 마이그레이션**: 과거 버전에서 다른 형태로 저장된 데이터
3. **타입 안전성**: TypeScript가 컴파일 타임에 체크할 수 없는 런타임 데이터 검증

### 안전한 폴백 처리

```tsx
const loadWidth = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sidebarWidth)
    if (!raw) return SIDEBAR_WIDTH_LIMITS.default

    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return SIDEBAR_WIDTH_LIMITS.default

    // ✅ Min/max clamping
    return Math.max(SIDEBAR_WIDTH_LIMITS.min, Math.min(parsed, SIDEBAR_WIDTH_LIMITS.max))
  } catch {
    return SIDEBAR_WIDTH_LIMITS.default
  }
}
```

모든 경로에서 안전한 기본값을 반환하므로 앱이 크래시하지 않습니다.

---

## 7. Derived State

계산 가능한 값은 저장하지 말고 필요할 때 계산합니다. 이렇게 하면 동기화 문제가 발생하지 않습니다.

### ✅ 패턴: isDirty 계산

```tsx
// tabStore.ts (실제 코드)
export interface Tab {
  id: string
  filePath: string | null
  fileName: string
  content: string
  savedContent: string
  // ❌ isDirty: boolean  -- 저장하지 않음!
}
```

`isDirty`는 저장하지 않고 사용하는 곳에서 계산합니다:

```tsx
// TabBar.tsx, App.tsx
const isDirty = tab.content !== tab.savedContent // ✅ 항상 정확함
```

### ❌ 안티패턴: Derived State 저장

```tsx
// ❌ 동기화 문제 발생
interface Tab {
  content: string
  savedContent: string
  isDirty: boolean // ❌ content가 변경될 때마다 업데이트 필요
}

// updateContent 할 때마다 isDirty도 업데이트해야 함
updateContent: (id, content) => {
  set(s => ({
    tabs: s.tabs.map(t =>
      t.id === id
        ? { ...t, content, isDirty: content !== t.savedContent } // ❌ 실수하기 쉬움
        : t
    ),
  }))
}
```

이 방식은 버그가 발생하기 쉽습니다. `markClean()`에서도 `isDirty`를 업데이트해야 하고, 한 곳이라도 누락되면 UI가 틀려집니다.

### Footer의 Derived Primitives

```tsx
// useDocumentStats.ts (실제 코드)
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
```

`wordCount`, `charCount`, `lineCount`를 store에 저장하지 않고 `content`가 변경될 때마다 재계산합니다.

---

## 8. Transient Notifications

일시적 UI 상태(알림, 토스트 등)는 persistence가 필요 없습니다.

### 패턴: flashStatus

```tsx
// editorStore.ts (실제 코드)
let statusTimer: ReturnType<typeof setTimeout> | null = null

export const useEditorStore = create<EditorState>(set => ({
  mode: 'split',
  setMode: mode => set({ mode }),
  statusText: '',

  flashStatus: (text, ms = STATUS_TIMEOUT_MS.default) => {
    if (statusTimer) clearTimeout(statusTimer)
    set({ statusText: text })
    statusTimer = setTimeout(() => set({ statusText: '' }), ms)
  },
}))
```

### 사용 예제

```tsx
// useFileSystem.ts
try {
  await invokeTauri('write_file', { path: tab.filePath, content: tab.content })
  markClean(activeTabId, tab.content)
  useEditorStore.getState().flashStatus('Saved') // ✅ 3초 후 자동 사라짐
} catch (e) {
  useEditorStore.getState().flashStatus(
    `Save failed: ${msg}`,
    STATUS_TIMEOUT_MS.critical // ✅ 더 긴 표시 시간
  )
}
```

### Footer에서 표시

```tsx
// Footer.tsx (실제 코드)
const statusText = useEditorStore(s => s.statusText)

return (
  <footer>
    <span aria-live="polite" aria-atomic="true">
      {statusText || 'Ready'}
    </span>
  </footer>
)
```

`aria-live="polite"`로 스크린 리더에도 알림을 전달합니다.

---

## 핵심 교훈

### 1. **Primitive 반환으로 리렌더링 최소화**

```tsx
✅ const mode = useEditorStore(s => s.mode)
❌ const { mode } = useEditorStore(s => ({ mode: s.mode }))
```

### 2. **비동기/콜백에서는 getState() 사용**

```tsx
✅ const tabs = useTabStore.getState().tabs  // 최신 상태
❌ const tabs = useTabStore(s => s.tabs)     // 렌더링 시점 상태 (stale)
```

### 3. **Pure Function을 Module-Level로 추출**

- 테스트 용이성
- 재사용성
- Store 정의 간결화

### 4. **Atomic Update로 중간 상태 방지**

```tsx
✅ set({ rootPath: dir, treeData: entries })  // 원자적
❌ set({ rootPath: dir }); set({ treeData: entries })  // 깜빡임
```

### 5. **Persist는 선택적으로 (partialize)**

- 사용자 설정만 저장
- 민감한 데이터(검색어 등)는 제외

### 6. **localStorage는 Type Guard로 검증**

```tsx
const parsed: unknown = JSON.parse(raw)
return Array.isArray(parsed) ? parsed.filter(isRecentFile) : []
```

### 7. **Derived State는 저장하지 말고 계산**

```tsx
✅ isDirty = tab.content !== tab.savedContent
❌ store에 isDirty 필드 추가
```

### 8. **일시적 UI는 Transient로**

- Persistence 불필요
- 타이머로 자동 제거

---

## 참고 자료

- [Zustand 공식 문서](https://github.com/pmndrs/zustand)
- [React 최적화 가이드](https://react.dev/learn/render-and-commit)
- 프로젝트 내 예제:
  - `src/stores/settingsStore.ts` — Module-level helpers
  - `src/stores/sidebarStore.ts` — Atomic updates, type guards
  - `src/stores/tabStore.ts` — Derived state, getState() 패턴
  - `src/hooks/useAutoSave.ts` — Stale closure 방지
  - `src/hooks/useDocumentStats.ts` — Derived primitives
