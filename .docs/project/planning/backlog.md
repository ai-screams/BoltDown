# BoltDown — Unified Backlog

> 단일 백로그. Phase 구분 없이 우선순위(Priority)로 관리.
> SSoT: 이 파일이 모든 미완료 작업의 유일한 출처.
> 최종 갱신: 2026-02-17 (Waves 1-6 완료 후 정리)

---

## Security

> 출처: PR #28 코드 리뷰 (2026-02-16). Wave 2/6 완료 후 남은 항목.

### S-LOW

| ID  | Issue                    | Location                                     | Description                                                       |
| --- | ------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| S8  | ReDoS 보호 제한적        | `FindReplaceModal.tsx`                       | 기본 휴리스틱만 적용. 현재 수준 적절하나 Web Worker 격리 고려.    |
| S9  | JSON.parse 스키마 미검증 | `settingsStorage.ts:7`, `sidebarStore.ts:12` | Settings JSON 런타임 스키마 검증 없음. zod 등으로 검증 추가 고려. |

---

## Performance

### P-MEDIUM

| ID  | Issue                    | Location              | Description                                                   |
| --- | ------------------------ | --------------------- | ------------------------------------------------------------- |
| P5  | Preview 매번 전체 재파싱 | `MarkdownPreview.tsx` | content 변경 시 markdown-it 전체 재파싱. 증분 파싱 고려 가능. |

---

## Quality

### Q-MEDIUM

| ID  | Issue                   | Location                 | Description                                                                   |
| --- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Q4  | wysiwyg.ts God Object   | `wysiwyg.ts` (969 lines) | 23개 위젯 + 15개 헬퍼. 모듈 분리 필요.                                        |
| Q5  | Auto-save 전체 탭 반복  | `useAutoSave.ts`         | 1개 탭 편집 시 전체 검사. dirty Set 추적 필요.                                |
| Q6  | loadSettings 혼합 책임  | `settingsStore.ts`       | 로드 + 테마 + 리스너 + 마이그레이션 한 함수. 분리 필요.                       |
| Q11 | 위젯 내 직접 store 접근 | `wysiwyg.ts:364`         | ImageWidget.toDOM()에서 `useTabStore.getState()` 직접 호출. 의존성 주입 필요. |

---

## UX Polish

> 출처: polish-backlog.md (2026-02-15). Wave 6 완료 후 남은 항목.

| ID  | Issue                               | Location                          | Description                                                                   |
| --- | ----------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| U3  | Tree data flash on directory switch | `sidebarStore.ts`                 | `setRootPath` → `setTreeData` 순서 문제. 원자적 업데이트 필요.                |
| U4  | Zen/Split 렌더링 패리티             | `wysiwyg.ts`, `markdownConfig.ts` | CM6 데코레이션 vs markdown-it 파싱 차이. 회귀 픽스처 세트 필요.               |
| U5  | Spellcheck underline (macOS Tauri)  | `MarkdownEditor.tsx`              | WKWebView에서 실시간 밑줄 불안정. OS 메뉴 통합 또는 Hunspell 파이프라인 고려. |

---

## Priority Roadmap

### Next Sprint — Quality Improvements

1. **Q4** wysiwyg.ts 모듈 분할 (969 lines → separate modules)
2. **Q5** Auto-save dirty Set 추적
3. **Q6** loadSettings 책임 분리
4. **Q11** 위젯 store 접근 의존성 주입

### After — Performance & UX

1. **P5** Preview 증분 파싱 고려
2. **U3** Tree data 원자적 업데이트
3. **U4** Zen/Split 렌더링 패리티
4. **U5** Spellcheck underline 개선

### Housekeeping

- **S8-S9**: 보안 강화 (ReDoS Worker 격리, JSON 스키마 검증)

---

## Completed (Waves 1-6)

### Wave 1 — Phase 2 Completion (ba748dd)

- **F1** ✅ Keyboard Shortcuts Panel (Cmd+? 모달)
- **F2** ✅ Changelog Modal (버전별 변경 내역)
- **F3** ✅ About Modal (앱 정보, 라이선스, 크레딧)
- **Q3** ✅ Find silent truncation (사용자 알림 추가)

### Wave 2 — Security Hardening (3fd4ce6)

- **S1** ✅ Mermaid securityLevel 'loose' 경고 UI 추가
- **S2** ✅ Custom CSS sanitization (`sanitizeCustomCss`)
- **S3+S4** ✅ DOMPurify 적용 (markdown-it → preview)
- **S5** ✅ KaTeX innerHTML sanitization (`sanitizeKatexHtml`)
- **S6** ✅ Prism.js innerHTML sanitization (`sanitizeCodeHtml`)
- **S7** ✅ Export HTML sanitization + CSP meta tag

### Wave 3+4 — Performance + Quality (7b1bb84)

- **P2** ✅ KaTeX LRU 캐시 (200 entries)
- **P3** ✅ Mermaid LRU 캐시 (50 entries, WYSIWYG + Preview)
- **Q1** ✅ Auto-save 경합 조건 (content snapshot + pending blur save)
- **Q2** ✅ Mermaid 렌더 토큰 경합 (debounce 150ms)

### Wave 5 — Housekeeping (c589205)

- **Q8** ✅ loadParentDirectory 에러 로깅 (`console.error` 추가)
- **Q10** ✅ resolveCssToken 재귀 깊이 (depth guard max 10)
- **Q12** ✅ 불필요한 Set → `THEME_MODES.includes()`
- **Q15** ✅ 불필요한 useMemo 제거 (인라인 `matches.slice()`)

### Wave 6 — Quick Wins (6e38e9c)

- **S10** ✅ npm audit fix (mermaid 취약점 7개 → 0개)
- **Q9** ✅ duplicateFile shared util (`findAvailableCopyPath`, IPC 100회 → 1회)
- **U1** ✅ Cross-platform 경로 (`joinPath`/`getDirectoryPath` 사용)
- **U2** ✅ Sidebar auto-open 개선 (`sidebarState.isOpen` 존중)

### Non-Issues (팩트체크 후 제거)

- **P1** WYSIWYG 전체 데코레이션 재빌드 — KaTeX/Mermaid 캐싱으로 실질적 해결
- **P4** useDocumentStats debounce — 이미 500ms debounce 적용됨
- **Q7** buildQuery replaceText 의존성 — 의도적 설계 (replace 모드 전용)
- **Q13** EMPTY_STATS 미사용 — 실제로 useState 초기값으로 사용 중
- **Q14** 불필요한 ref 간접 참조 — React 권장 패턴 (stale closure 방지)
- **P6** Prism.js 전체 번들 — YAGNI (각 언어 1-5KB, 동적 import 복잡도 불필요)
- **P7** TableWidget DOM 재생성 — CM6 `eq()` 메커니즘으로 불필요한 toDOM() 방지

---

## Related Documents

- **PRD (원본 비전)**: `.docs/spec/prd/feature-roadmap.md` — Phase 1-4 전체 로드맵
- **Find & Replace 고급**: `.docs/project/planning/archive/polishing-phase-backlog.md` — Search history, Cmd+D 등
- **Phase 2 아카이브**: `.docs/project/planning/archive/phase2-plan.md`
- **아키텍처**: `AGENTS.md` (루트 및 각 디렉토리)
