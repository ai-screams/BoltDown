# BoltDown — Unified Backlog

> 단일 백로그. 활성 코드 작업은 완료되었고 Known Issues만 유지.
> SSoT: 이 파일은 현재/활성 계획 상태의 기준 문서이며, 구현 세부 이력은 `AGENTS.md`, `MEMORY.md`, `git log`를 함께 참조.
> 최종 갱신: 2026-02-18 (Waves 1-9 완료, 문서/메모리 팩트체크 반영)

---

## Known Issues

> 구조적 한계 또는 외부 의존성으로 인해 당장 해결하지 않는 항목.

| ID  | Issue                              | Location                        | 사유                                                                                                           |
| --- | ---------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| P5  | Preview 매번 전체 재파싱           | `MarkdownPreview.tsx`           | markdown-it 자체가 증분 파싱 미지원. tree-sitter/mdast 등 아키텍처 전환 필요. 대용량 문서에서만 체감.          |
| U4  | Zen/Split 렌더링 패리티            | `wysiwyg/`, `markdownConfig.ts` | CM6 데코레이션 vs markdown-it 파싱 엔진 차이. 완전한 패리티는 구조적으로 불가능. 회귀 픽스처 세트로 관리 필요. |
| U5  | Spellcheck underline (macOS Tauri) | `MarkdownEditor.tsx`            | macOS WKWebView 레벨 이슈. Tauri/앱 코드로 제어 불가. OS 업데이트 또는 Hunspell 자체 통합 필요.                |

---

## Completed (Waves 1-9)

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

### Wave 7 — Architecture Refactor (23d7fd1)

- **Q4** ✅ wysiwyg.ts 모듈 분할 (969 lines → 10 per-widget modules)
- **Q6** ✅ loadSettings 책임 분리 (module-level helpers)
- **Q11** ✅ ImageWidget DI 리팩토링 (constructor injection)

### Wave 8 — Fact-Check & Fix (d464ff2, 30b9f0e)

- **U3** ✅ Tree data flash 수정 (원자적 `set({rootPath, treeData})`)
- **S9** ✅ loadRecentFiles 런타임 타입 검증 (type guard + `Array.filter`)

### Wave 9 — Docs & Memory Sync (2026-02-18)

- **D1** ✅ `AGENTS.md` 팩트체크 동기화 (Phase 2 상태/브랜치/ARIA/ACL 문구 정합성)
- **D2** ✅ `MEMORY.md` 최신 변경 이력 반영 (Wave 7/8 + 문서 동기화)
- **D3** ✅ Serena memory 갱신 (프로젝트 개요/Phase 상태/검증 로그 최신화)

### Non-Issues (팩트체크 후 제거)

- **P1** WYSIWYG 전체 데코레이션 재빌드 — KaTeX/Mermaid 캐싱으로 실질적 해결
- **P4** useDocumentStats debounce — 이미 500ms debounce 적용됨
- **Q7** buildQuery replaceText 의존성 — 의도적 설계 (replace 모드 전용)
- **Q13** EMPTY_STATS 미사용 — 실제로 useState 초기값으로 사용 중
- **Q14** 불필요한 ref 간접 참조 — React 권장 패턴 (stale closure 방지)
- **P6** Prism.js 전체 번들 — YAGNI (각 언어 1-5KB, 동적 import 복잡도 불필요)
- **P7** TableWidget DOM 재생성 — CM6 `eq()` 메커니즘으로 불필요한 toDOM() 방지
- **Q5** Auto-save 전체 탭 반복 — debounce + early continue로 실질적 비용 무시 가능
- **S8** ReDoS 보호 제한적 — 4중 보호 (길이+그룹+패턴+타임아웃) 이미 충분

---

## Related Documents

- **PRD (원본 비전)**: `.docs/spec/prd/feature-roadmap.md` — Phase 1-4 전체 로드맵
- **Find & Replace 고급**: `.docs/project/planning/archive/polishing-phase-backlog.md` — Search history, Cmd+D 등
- **Phase 2 아카이브**: `.docs/project/planning/archive/phase2-plan.md`
- **아키텍처**: `AGENTS.md` (루트 및 각 디렉토리)
