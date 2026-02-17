# Tauri 2.0 + React Integration Patterns

BoltDown 프로젝트의 Tauri 2.0 백엔드와 React 19 프론트엔드 통합 패턴을 다루는 기술 참고 문서.

**작성일**: 2026-02-18
**대상 독자**: Tauri + React 프로젝트를 개발하거나 유지보수하는 개발자

---

## 목차

1. [Dual-Environment 패턴](#1-dual-environment-패턴)
2. [IPC Command 설계](#2-ipc-command-설계)
3. [Rust Error 타입](#3-rust-error-타입)
4. [Modular Command Architecture](#4-modular-command-architecture)
5. [ACL (Access Control List)](#5-acl-access-control-list)
6. [Path Security](#6-path-security)
7. [Plugin System](#7-plugin-system)
8. [Settings Persistence](#8-settings-persistence)
9. [핵심 교훈](#9-핵심-교훈)

---

## 1. Dual-Environment 패턴

BoltDown은 **Desktop (Tauri)** 환경과 **Browser (Vite dev server)** 환경을 모두 지원한다. 이를 통해 개발 시 빠른 HMR을 활용하면서도 프로덕션에서는 네이티브 앱의 장점을 누린다.

### 1.1 Environment Detection

**`src/utils/tauri.ts`** — Tauri 환경 감지 함수

```typescript
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
```

- `__TAURI_INTERNALS__`는 Tauri 런타임이 주입하는 전역 객체
- SSR 환경 대비 `typeof window !== 'undefined'` 체크 필수
- 단순하지만 **100% 신뢰할 수 있는** 감지 방법

### 1.2 Generic IPC Wrapper

**`src/utils/tauri.ts`** — Type-safe IPC 호출 래퍼

```typescript
export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
```

- **Dynamic import**: 브라우저 환경에서 Tauri 모듈 누락 에러 방지
- **Generic `<T>`**: 반환 타입 추론으로 type safety 보장
- **Record<string, unknown>**: 유연한 인자 전달

### 1.3 Branching Pattern in Hooks

**`src/hooks/useFileSystem.ts`** — Dual-environment 파일 작업

```typescript
const openFile = useCallback(async () => {
  if (!isTauri()) {
    // Browser: File System Access API 사용
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = MARKDOWN_FILE_TYPES.inputAccept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      openTab(null, file.name, text)
    }
    input.click()
    return
  }

  // Tauri: Native file dialog + IPC 사용
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      filters: [{ name: 'Markdown', extensions: [...MARKDOWN_FILE_TYPES.extensions] }],
    })
    if (!selected) return
    const path = typeof selected === 'string' ? selected : selected[0]
    if (!path) return
    const text = await invokeTauri<string>('read_file', { path })
    const name = getFileName(path, FILE_DEFAULTS.untitledName)
    openTab(path, name, text)
    addRecentFile(path, name)
  } catch (e) {
    console.error('Open file failed:', e)
    useEditorStore.getState().flashStatus('Open failed', STATUS_TIMEOUT_MS.error)
  }
}, [openTab, addRecentFile])
```

**패턴 요약**:

1. `isTauri()` 체크로 환경 분기
2. Browser: HTML5 API fallback (제한적 기능)
3. Tauri: Native API + IPC (full-featured)

**왜 양쪽을 지원하는가?**

- **개발 편의성**: `pnpm dev` (Vite) vs `pnpm tauri:dev` 중 선택 가능
- **점진적 마이그레이션**: 웹 버전 배포 가능성 열어둠
- **CI/테스트**: 브라우저 환경에서 UI 로직 테스트 가능

---

## 2. IPC Command 설계

Tauri의 IPC (Inter-Process Communication)는 **Rust 함수**를 프론트엔드에 노출시키는 메커니즘이다.

### 2.1 Command Definition

**`src-tauri/src/commands/file.rs`** — 파일 읽기 command

```rust
use crate::error::AppError;
use crate::utils::path::{validate_path, MAX_FILE_SIZE};

/// Reads the contents of a file as UTF-8 text.
/// Returns an error if the file exceeds [`MAX_FILE_SIZE`].
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, AppError> {
    let validated = validate_path(&path)?;

    let metadata = tokio::fs::metadata(&validated).await?;
    let size = metadata.len();
    if size > MAX_FILE_SIZE {
        return Err(AppError::FileTooLarge {
            size,
            max: MAX_FILE_SIZE,
        });
    }

    let content = tokio::fs::read_to_string(&validated).await?;
    Ok(content)
}
```

**핵심 요소**:

- `#[tauri::command]`: 매크로가 IPC 직렬화/역직렬화 코드 생성
- `async fn`: 비동기 I/O (tokio 런타임)
- `Result<T, AppError>`: 타입 안전한 에러 처리
- **Path validation**: 보안 체크 (section 6 참고)
- **Size limit**: DoS 방지 (50MB 제한)

### 2.2 Parameter Passing

Tauri는 JSON을 통해 TypeScript ↔ Rust 타입 변환을 수행한다.

**TypeScript**:

```typescript
const text = await invokeTauri<string>('read_file', { path: '/Users/me/doc.md' })
```

**Rust**:

```rust
pub async fn read_file(path: String) -> Result<String, AppError>
```

- `{ path: '/Users/me/doc.md' }` → `path: String`
- 인자 이름이 **정확히 일치**해야 함
- 복잡한 타입은 `#[derive(Serialize, Deserialize)]` 필요

### 2.3 Command Registration

**`src-tauri/src/lib.rs`** — Builder에 command 등록

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::file::read_file,
            commands::file::write_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::file::copy_file,
            commands::file::write_binary_file,
            commands::directory::list_directory,
            commands::settings::read_settings,
            commands::settings::write_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- `.invoke_handler()`: command 목록 등록
- `generate_handler![]`: 매크로가 dispatch 로직 생성
- **등록하지 않은 command는 IPC 실패** (silent error 주의)

---

## 3. Rust Error 타입

Tauri IPC는 Rust의 `Result<T, E>` 패턴을 그대로 사용한다. 에러는 JSON으로 직렬화되어 프론트엔드로 전달된다.

### 3.1 AppError Enum

**`src-tauri/src/error.rs`** — 애플리케이션 전역 에러 타입

```rust
use serde::Serialize;

/// Application-wide error type for Tauri commands.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("Path validation failed: {0}")]
    PathValidation(String),

    #[error("Path traversal detected")]
    PathTraversal,

    #[error("Not a directory: {0}")]
    NotADirectory(String),

    #[error("File too large: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

**핵심 기법**:

- `#[derive(thiserror::Error)]`: `Display` 자동 구현
- `#[error("...")]`: 각 variant의 에러 메시지 정의
- `#[from]`: `std::io::Error`에서 자동 변환 (`?` 연산자 지원)
- **Custom `Serialize`**: Tauri IPC 요구사항 (에러를 문자열로 직렬화)

### 3.2 Error Propagation

**Rust (backend)**:

```rust
pub async fn read_file(path: String) -> Result<String, AppError> {
    let validated = validate_path(&path)?;  // PathValidation or PathTraversal
    let content = tokio::fs::read_to_string(&validated).await?;  // Io
    Ok(content)
}
```

**TypeScript (frontend)**:

```typescript
try {
  const text = await invokeTauri<string>('read_file', { path })
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('Read failed:', msg, e)
  flashStatus(`Read failed: ${msg}`)
}
```

- Rust `Err` → IPC rejection → TypeScript exception
- 에러 메시지는 `AppError::to_string()` 결과
- **타입 정보 소실**: TypeScript에서는 plain Error 객체로 전달됨

---

## 4. Modular Command Architecture

Command 수가 증가하면 단일 파일 관리가 어렵다. BoltDown은 **기능별 모듈**로 command를 분리한다.

### 4.1 Module Structure

```
src-tauri/src/
├── commands/
│   ├── mod.rs          # Re-exports
│   ├── file.rs         # read_file, write_file, rename_file, delete_file, copy_file, write_binary_file
│   ├── directory.rs    # list_directory
│   └── settings.rs     # read_settings, write_settings
├── utils/
│   ├── mod.rs
│   └── path.rs         # validate_path, MAX_FILE_SIZE
├── error.rs            # AppError enum
└── lib.rs              # Builder + plugin init + command registration
```

### 4.2 Module Re-exports

**`src-tauri/src/commands/mod.rs`** — 공개 API 정의

```rust
pub mod directory;
pub mod file;
pub mod settings;
```

- 각 모듈의 함수는 `pub` 키워드로 외부 노출
- `lib.rs`에서 `commands::file::read_file` 형태로 참조

### 4.3 Shared Utilities

**`src-tauri/src/utils/path.rs`** — Path validation 로직

```rust
pub const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

pub fn validate_path(path_str: &str) -> Result<PathBuf, AppError> {
    let path = PathBuf::from(path_str);

    let canonical = path.canonicalize().or_else(|_| {
        let parent = path
            .parent()
            .ok_or_else(|| AppError::PathValidation("No parent directory".into()))?;
        let file_name = path
            .file_name()
            .ok_or_else(|| AppError::PathValidation("No file name".into()))?;
        parent
            .canonicalize()
            .map(|p| p.join(file_name))
            .map_err(|e| {
                AppError::PathValidation(format!("Parent directory does not exist: {}", e))
            })
    })?;

    if canonical.components().any(|c| c == Component::ParentDir) {
        return Err(AppError::PathTraversal);
    }

    Ok(canonical)
}
```

- **모든 command**가 `validate_path()` 호출 → DRY 원칙
- utils는 command가 아니므로 `#[tauri::command]` 불필요

**확장 방법**:

1. 새 기능 카테고리 추가: `commands/export.rs` 생성
2. `commands/mod.rs`에 `pub mod export;` 추가
3. `lib.rs`의 `generate_handler![]`에 등록

---

## 5. ACL (Access Control List)

Tauri 2.0은 **"deny by default"** 보안 모델을 사용한다. 모든 권한은 명시적으로 허용해야 한다.

### 5.1 Capability Definition

**`src-tauri/capabilities/default.json`** — 메인 윈도우 권한 설정

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for BoltDown main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "shell:allow-open",
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": ["$HOME/**/*", "$DOCUMENT/**/*", "$DESKTOP/**/*", "$DOWNLOAD/**/*", "$APPDATA/**/*"],
      "deny": ["$HOME/.ssh/**", "$HOME/.gnupg/**", "$HOME/.aws/**"]
    }
  ]
}
```

**핵심 개념**:

- `identifier`: 이 capability의 고유 이름
- `windows`: 적용 대상 윈도우 목록
- `permissions`: 허용할 권한 배열
  - `core:default`: 기본 Tauri API
  - `dialog:default`: 파일/폴더 dialog
  - `shell:allow-open`: URL 열기
  - `fs:default`: 파일 시스템 기본 작업
  - `fs:scope`: 파일 시스템 접근 경로 제한

### 5.2 Path Scope

```json
{
  "identifier": "fs:scope",
  "allow": [
    "$HOME/**/*", // 사용자 홈 디렉토리
    "$DOCUMENT/**/*", // 문서 폴더
    "$DESKTOP/**/*", // 데스크톱
    "$DOWNLOAD/**/*", // 다운로드
    "$APPDATA/**/*" // 앱 데이터 (settings 저장)
  ],
  "deny": [
    "$HOME/.ssh/**", // SSH 키
    "$HOME/.gnupg/**", // GPG 키
    "$HOME/.aws/**" // AWS credentials
  ]
}
```

- `allow`: glob 패턴으로 접근 허용 경로 지정
- `deny`: allow보다 우선순위 높음 (명시적 차단)
- **변수 치환**: `$HOME`, `$DOCUMENT` 등은 OS별로 자동 확장

### 5.3 Silent IPC Failure

**권한이 없을 때 무슨 일이 일어나는가?**

```typescript
// ACL에 fs:default가 없는 경우
try {
  await invokeTauri('read_file', { path: '/Users/me/doc.md' })
} catch (e) {
  // ❌ "Command read_file not found" 같은 에러 발생
  // IPC 자체가 차단되어 command가 실행되지 않음
}
```

- Tauri는 **명시적 에러 메시지 제공 안 함**
- 개발 중 권한 누락 시 디버깅 어려움
- **해결책**: `capabilities/default.json`을 먼저 확인

---

## 6. Path Security

데스크톱 앱도 **path traversal 공격**에 취약하다. 사용자가 입력한 경로를 무조건 신뢰하면 안 된다.

### 6.1 Attack Scenario

```typescript
// 악의적 사용자가 조작한 경로
await invokeTauri('read_file', {
  path: '/Users/me/docs/../../../etc/passwd',
})
```

- `../`를 사용해 의도하지 않은 시스템 파일 접근
- ACL `deny` 목록을 우회할 수 있음

### 6.2 Path Validation

**`src-tauri/src/utils/path.rs`** — Canonical path 검증

```rust
use std::path::{Component, PathBuf};
use crate::error::AppError;

pub fn validate_path(path_str: &str) -> Result<PathBuf, AppError> {
    let path = PathBuf::from(path_str);

    // 1. Canonicalize: 심볼릭 링크 해소 + 절대 경로 변환
    let canonical = path.canonicalize().or_else(|_| {
        // 파일이 아직 없는 경우: 부모 디렉토리만 canonicalize
        let parent = path
            .parent()
            .ok_or_else(|| AppError::PathValidation("No parent directory".into()))?;
        let file_name = path
            .file_name()
            .ok_or_else(|| AppError::PathValidation("No file name".into()))?;
        parent
            .canonicalize()
            .map(|p| p.join(file_name))
            .map_err(|e| {
                AppError::PathValidation(format!("Parent directory does not exist: {}", e))
            })
    })?;

    // 2. ParentDir 컴포넌트 존재 여부 검사
    if canonical.components().any(|c| c == Component::ParentDir) {
        return Err(AppError::PathTraversal);
    }

    Ok(canonical)
}
```

**검증 단계**:

1. **Canonicalization**: `../`, `./`, symlink를 모두 해소한 절대 경로 생성
2. **ParentDir 검사**: 변환 후에도 `..`이 남아있으면 공격으로 간주
3. **부모 디렉토리 fallback**: 새 파일 생성 시에도 작동 (부모만 검증)

### 6.3 Usage in Commands

**모든 command가 validate_path() 호출**:

```rust
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    let validated = validate_path(&path)?;  // ← 보안 체크
    let tmp_path = {
        let mut name = validated.as_os_str().to_os_string();
        name.push(".tmp");
        PathBuf::from(name)
    };
    tokio::fs::write(&tmp_path, &content).await?;
    tokio::fs::rename(&tmp_path, &validated).await?;  // Atomic write
    Ok(())
}
```

- Path validation 실패 → `AppError::PathTraversal` → IPC rejection
- **ACL + path validation**: 이중 보안 장치

---

## 7. Plugin System

Tauri 2.0은 공식 plugin을 통해 파일 시스템, dialog, shell 등의 기능을 제공한다.

### 7.1 Plugin Initialization

**`src-tauri/src/lib.rs`** — Builder에 plugin 등록

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())       // File system
        .plugin(tauri_plugin_dialog::init())   // Native dialogs
        .plugin(tauri_plugin_shell::init())    // Shell commands
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- **순서 중요**: plugin은 command 등록 전에 초기화
- `.plugin()` 체이닝으로 여러 plugin 등록

### 7.2 Frontend API Access

Plugin 초기화 후 프론트엔드에서 API 사용 가능.

**`tauri-plugin-dialog`** 사용 예시:

```typescript
const { open } = await import('@tauri-apps/plugin-dialog')
const selected = await open({
  filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
})
```

**`tauri-plugin-fs`** 사용 예시:

```typescript
// BoltDown은 custom command 사용으로 직접 호출 안 함
// 하지만 plugin-fs가 없으면 ACL fs:default 동작 안 함
```

### 7.3 Plugin vs Custom Command

| 방법               | 장점                                 | 단점                     |
| ------------------ | ------------------------------------ | ------------------------ |
| **Plugin**         | 공식 지원, 문서화 잘 됨, ACL 통합    | 커스터마이징 제한적      |
| **Custom Command** | 완전한 제어, 비즈니스 로직 추가 가능 | 보안/에러 처리 직접 구현 |

**BoltDown의 선택**:

- File I/O: **Custom command** (path validation + size limit 필요)
- Dialog: **Plugin** (표준 기능으로 충분)
- Shell: **Plugin** (URL 열기만 사용)

---

## 8. Settings Persistence

설정 저장은 **Desktop (appDataDir)** 과 **Browser (localStorage)** 에서 다르게 처리된다.

### 8.1 Tauri: appDataDir + IPC Commands

**`src-tauri/src/commands/settings.rs`** — 설정 파일 read/write

```rust
use tauri::Manager;
use crate::error::AppError;

#[tauri::command]
pub async fn read_settings(app_handle: tauri::AppHandle) -> Result<String, AppError> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::PathValidation(format!("Failed to resolve app data dir: {}", e)))?
        .join("settings.json");

    match tokio::fs::read_to_string(&path).await {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("null".to_string()),
        Err(e) => Err(AppError::Io(e)),
    }
}

#[tauri::command]
pub async fn write_settings(
    app_handle: tauri::AppHandle,
    settings: String,
) -> Result<(), AppError> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::PathValidation(format!("Failed to resolve app data dir: {}", e)))?;

    tokio::fs::create_dir_all(&dir).await?;  // 디렉토리 없으면 생성

    let path = dir.join("settings.json");
    let tmp_path = dir.join("settings.json.tmp");

    tokio::fs::write(&tmp_path, &settings).await?;
    tokio::fs::rename(&tmp_path, &path).await?;  // Atomic write

    Ok(())
}
```

**핵심 패턴**:

- `app_handle.path().app_data_dir()`: OS별 표준 경로 자동 해결
  - macOS: `~/Library/Application Support/com.boltdown.app/`
  - Windows: `C:\Users\<User>\AppData\Roaming\com.boltdown.app\`
  - Linux: `~/.local/share/com.boltdown.app/`
- **Atomic write**: `.tmp` 파일에 쓰고 rename (corruption 방지)
- **NotFound 처리**: 최초 실행 시 `"null"` 반환 (에러 아님)

### 8.2 Frontend: Dual-Path Storage

**`src/utils/settingsStorage.ts`** — 환경별 분기 로직

```typescript
import { invokeTauri, isTauri } from '@/utils/tauri'

export async function loadSettingsFromStorage(): Promise<Partial<AppSettings> | null> {
  if (isTauri()) {
    try {
      const raw = await invokeTauri<string>('read_settings')
      if (raw === 'null' || !raw) return null
      return parseSettingsJson(raw)
    } catch (e) {
      console.error('Failed to load settings from Tauri:', e)
      return null
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    return raw ? parseSettingsJson(raw) : null
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e)
    return null
  }
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  const json = JSON.stringify(settings, null, 2)

  if (isTauri()) {
    try {
      await invokeTauri('write_settings', { settings: json })
    } catch (e) {
      console.error('Failed to save settings to Tauri:', e)
    }
    return
  }

  try {
    localStorage.setItem(STORAGE_KEYS.settings, json)
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e)
  }
}
```

### 8.3 Store Integration

**`src/stores/settingsStore.ts`** — Zustand store with debounced save

```typescript
let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSave(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveSettingsToStorage(settings) // ← settingsStorage.ts 사용
  }, SETTINGS_POLICY.saveDebounceMs)
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const patchCategory = <K extends SettingsCategory>(
    category: K,
    patch: Partial<AppSettings[K]>
  ): void => {
    const previous = get().settings
    const next = { ...previous, [category]: { ...previous[category], ...patch } }
    set({ settings: next })
    if (category === 'theme') applyTheme(next.theme)
    debouncedSave(next) // ← 500ms 디바운스
  }

  return {
    settings: DEFAULT_SETTINGS,
    isLoaded: false,
    updateTheme: patch => patchCategory('theme', patch),
    updateEditor: patch => patchCategory('editor', patch),
    // ...
    loadSettings: async () => {
      const stored = await loadSettingsFromStorage()
      if (stored) {
        const merged = mergeWithDefaults(stored, DEFAULT_SETTINGS)
        set({ settings: merged, isLoaded: true })
        applyTheme(merged.theme)
      } else {
        set({ isLoaded: true })
        applyTheme(DEFAULT_SETTINGS.theme)
      }
    },
  }
})
```

**흐름**:

1. 앱 시작 → `loadSettings()` 호출
2. `isTauri()` 체크 → Tauri IPC or localStorage
3. 설정 변경 → `patchCategory()` → `debouncedSave()` (500ms 디바운스)
4. Tauri 환경 → `write_settings` command → `appDataDir/settings.json`
5. Browser 환경 → `localStorage.setItem()`

---

## 9. 핵심 교훈

### 9.1 Dual-Environment는 생산성 향상

- `pnpm dev` (Vite): 2초 HMR, 브라우저 DevTools
- `pnpm tauri:dev`: 5초 rebuild, 네이티브 기능 테스트
- **전략**: UI 작업은 Vite, 파일/IPC 작업은 Tauri

### 9.2 IPC는 Type-Safe하지만 완벽하지 않음

- TypeScript ↔ Rust 타입은 **런타임**에 검증됨
- Command 이름 오타 → silent failure
- 인자 이름 불일치 → deserialization error
- **해결책**: Integration test 작성

### 9.3 에러 처리는 명시적으로

- Rust `Result<T, E>` → TypeScript `try/catch`
- 에러 메시지는 사용자에게 보여줄 내용 중심으로 작성
- **Anti-pattern**: `console.error()` 만 찍고 무시

### 9.4 보안은 계층적으로

1. **ACL**: 파일 시스템 접근 경로 제한
2. **Path validation**: Traversal 공격 차단
3. **Size limit**: DoS 방지
4. **Atomic write**: Data corruption 방지

각 레이어가 실패해도 다른 레이어가 방어.

### 9.5 Modular Architecture는 확장성의 핵심

- Command 수가 10개 이상이면 모듈 분리 필수
- utils는 여러 command가 공유하는 로직 집중
- **추가 팁**: 테스트도 모듈별로 분리 (`tests/commands/file_tests.rs`)

### 9.6 Plugin은 기본, Custom Command는 필요시

- 표준 기능은 plugin 사용 (유지보수 부담 감소)
- 비즈니스 로직 필요 시 custom command (BoltDown의 path validation 같은)
- **주의**: Plugin dependency 버전 충돌 주의 (Tauri 2.x 호환성 확인)

### 9.7 Atomic Write는 선택이 아닌 필수

```rust
// ❌ 나쁜 예: 직접 쓰기 (crash 시 파일 손상)
tokio::fs::write(&path, &content).await?;

// ✅ 좋은 예: .tmp 파일 + rename (atomic)
tokio::fs::write(&tmp_path, &content).await?;
tokio::fs::rename(&tmp_path, &path).await?;
```

### 9.8 appDataDir vs 사용자 선택 경로

- **Settings**: appDataDir (앱이 관리, ACL `$APPDATA` 권한 필요)
- **User files**: 사용자가 dialog로 선택 (ACL `$HOME` 등 권한 필요)
- **혼동 주의**: appDataDir은 hidden 디렉토리 (사용자가 직접 접근 안 함)

### 9.9 Debug 팁

1. **IPC 실패 시**: `capabilities/default.json` 권한 확인
2. **Path 에러 시**: `validate_path()` 로그 추가
3. **Type mismatch 시**: Rust command 시그니처 vs TS `invokeTauri<T>()` 비교
4. **Silent error 시**: Rust command에 `println!()` 추가 (Tauri console에 출력)

### 9.10 성능 고려사항

- **IPC는 비용이 크다**: 수백 번 호출 시 병목
- **해결책**: Batch operation command 제공 (`read_multiple_files`)
- **파일 watch**: plugin-fs의 watch API 사용 (poll 대신)
- **Large file**: Stream API 사용 고려 (현재는 50MB 제한)

---

## 참고 자료

- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Tauri IPC Guide](https://v2.tauri.app/develop/calling-rust/)
- [tauri-plugin-fs](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/fs)
- [thiserror crate](https://docs.rs/thiserror/)

---

**문서 버전**: 1.0
**마지막 검증**: 2026-02-18 (BoltDown commit 0cac458)
