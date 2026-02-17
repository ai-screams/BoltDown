# Phase 3 Backlog

> PR #28 코드 리뷰에서 발견된 이슈들. Security / Quality / Performance 3개 리뷰 통합.
> 작성일: 2026-02-16

---

## Security

### S-HIGH

| ID  | Issue                            | Location                                                    | Description                                                                                                                                                                                              |
| --- | -------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Mermaid `securityLevel: 'loose'` | `wysiwyg.ts:158`, `MarkdownPreview.tsx:27`, `settings.ts:7` | `'loose'` 모드는 다이어그램 내 JS 실행을 허용함. 악성 `.md` 파일을 열면 Tauri renderer 컨텍스트에서 임의 코드 실행 가능. `'loose'` 옵션 제거 또는 경고 UI 추가 필요.                                     |
| S2  | Custom CSS 미검증 삽입           | `useCustomCss.ts:25`                                        | `el.textContent = customCss`로 직접 삽입. CSS selector + `url()` 조합으로 데이터 유출 가능. 길이 제한은 UI에서만 적용되고 storage 레이어에서는 미적용. CSS sanitizer 또는 `url()` 외부 origin 차단 필요. |

### S-MEDIUM

| ID  | Issue                            | Location                  | Description                                                                                                                               |
| --- | -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S3  | markdown-it `html: true`         | `markdownConfig.ts:86`    | Raw HTML 패스스루 허용. CSP가 inline script를 차단하지만 `<style>`, `<iframe>` 등은 통과. `html: false`로 변경하거나 DOMPurify 적용 필요. |
| S4  | `dangerouslySetInnerHTML` 미살균 | `MarkdownPreview.tsx:169` | markdown-it 출력을 sanitize 없이 렌더링. S3과 결합 시 XSS 벡터. DOMPurify 적용 필요.                                                      |
| S5  | KaTeX `innerHTML`                | `wysiwyg.ts:375,398`      | KaTeX 렌더링 결과를 `innerHTML`로 삽입. KaTeX 자체 이스케이프에 의존. KaTeX 보안 권고 모니터링 필요.                                      |
| S6  | Prism.js `innerHTML`             | `wysiwyg.ts:514`          | Prism 하이라이트 결과를 `innerHTML`로 삽입. Prism 보안 업데이트 모니터링 (과거 CVE-2021-32723).                                           |
| S7  | Export HTML 미살균               | `useExport.ts:119`        | HTML export 시 markdown-it 출력을 sanitize 없이 standalone HTML에 삽입. 내보낸 파일을 브라우저에서 열면 CSP 보호 없이 XSS 가능.           |

### S-LOW

| ID  | Issue                    | Location                                     | Description                                                                                                                 |
| --- | ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| S8  | ReDoS 보호 제한적        | `FindReplaceModal.tsx:25-38`                 | 기본 휴리스틱만 적용 (패턴 길이 500, 캡처 그룹 10). `(a+)+b` 같은 패턴 미감지. 현재 수준으로 적절하나 Web Worker 격리 고려. |
| S9  | JSON.parse 스키마 미검증 | `settingsStorage.ts:7`, `sidebarStore.ts:12` | Settings JSON을 런타임 스키마 검증 없이 파싱. 파일시스템 접근 시 type confusion 가능. zod 등으로 검증 추가 고려.            |
| S10 | Mermaid 종속성 취약점    | `package.json` (mermaid)                     | `npm audit`에서 moderate 취약점 보고 (lodash-es via chevrotain). `npm audit fix` 실행 필요.                                 |

---

## Quality

### Q-HIGH

| ID  | Issue                  | Location                    | Description                                                                                                                                                                   |
| --- | ---------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Auto-save 탭 경합 조건 | `useAutoSave.ts:38-39`      | 탭 목록 snapshot과 re-fetch 사이에 탭이 닫힐 수 있음. 존재 확인 후 저장 전에 닫히면 stale content가 디스크에 저장될 수 있음. generation counter 또는 단일 트랜잭션 패턴 필요. |
| Q2  | Mermaid 렌더 토큰 경합 | `wysiwyg.ts:172-183`        | `renderMermaidInto()` 빠른 연속 호출 시 토큰 체크 실패. 토큰 할당이 동기적이고 렌더가 비동기라 stale 다이어그램 표시 가능. 토큰 증가를 컨테이너 할당 전에 수행해야 함.        |
| Q3  | Find silent truncation | `findReplaceStore.ts:38-50` | `setSearchText`/`setReplaceText`가 max 초과 시 경고 없이 잘라냄. 사용자 데이터 손실 인지 불가. UI에 truncation 경고 표시 필요.                                                |

### Q-MEDIUM

| ID  | Issue                            | Location                       | Description                                                                                                                                    |
| --- | -------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Q4  | wysiwyg.ts God Object            | `wysiwyg.ts` (931 lines)       | 23개 위젯 클래스 + 15개 헬퍼 + 313줄 `buildDecorations()`. 모듈 분리 필요: `widgets/`, `decorations/`, `math/` 등.                             |
| Q5  | Auto-save 전체 탭 반복           | `useAutoSave.ts:73-76`         | Zustand 구독이 모든 탭 변경에 반응. 1개 탭 편집 시 20개 탭 전체 검사. dirty Set 추적 또는 세분화된 구독 패턴 필요.                             |
| Q6  | loadSettings 혼합 책임           | `settingsStore.ts:141-171`     | 설정 로드 + 테마 적용 + 시스템 테마 리스너 등록 + 레거시 마이그레이션 한 함수에 혼합. HMR 시 리스너 중복 등록 가능. 함수 분리 필요.            |
| Q7  | buildQuery replaceText 의존성    | `FindReplaceModal.tsx:181-194` | `useMemo` 의존성 배열에 `replaceText` 미포함, store에서 직접 읽음. 의도된 동작이나 JSDoc 설명 부재.                                            |
| Q8  | loadParentDirectory 에러 무시    | `sidebarStore.ts:112-126`      | catch 블록이 모든 에러를 무시. 권한 오류, 프로그래밍 오류도 조용히 삼킴. 최소 console 로깅 추가 필요.                                          |
| Q9  | duplicateFile 비효율적 충돌 검사 | `useFileSystem.ts:140-187`     | 최대 50번 IPC 호출로 파일 존재 확인. 디렉토리 목록 1회 조회 후 JS에서 넘버링 로직 처리로 개선 가능.                                            |
| Q10 | resolveCssToken 재귀 깊이        | `useExport.ts:22-39`           | CSS 변수 참조 체인에 깊이 제한 없음. max depth (10) 파라미터 추가 또는 반복문 전환 필요.                                                       |
| Q11 | 위젯 내 직접 store 접근          | `wysiwyg.ts:348-350`           | `ImageWidget.toDOM()`에서 `useTabStore.getState()` 직접 호출. 데코레이션 생성과 DOM 구성 사이 타이밍 불일치 가능. 생성자 파라미터로 전달 필요. |

### Q-LOW

| ID  | Issue                    | Location                        | Description                                                                      |
| --- | ------------------------ | ------------------------------- | -------------------------------------------------------------------------------- |
| Q12 | 불필요한 Set 구성        | `settingsStore.ts:47-48`        | 3개 요소 배열에 Set 생성. `includes()`로 충분.                                   |
| Q13 | EMPTY_STATS 미사용       | `useDocumentStats.ts:14-33`     | 정의만 되고 사용되지 않음. 제거 또는 `useState` 초기값으로 활용.                 |
| Q14 | 불필요한 ref 간접 참조   | `useKeyboardShortcuts.ts:26-32` | `useCallback`으로 안정화된 함수에 ref 래핑. 직접 사용으로 단순화 가능.           |
| Q15 | 불필요한 useMemo (slice) | `FindReplaceModal.tsx:514-517`  | `matches.slice()` 메모이제이션. state 변경 시만 리렌더되므로 인라인 처리로 충분. |

---

## Performance

### P-CRITICAL

| ID  | Issue                          | Location                          | Description                                                                                                                                              |
| --- | ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | WYSIWYG 전체 데코레이션 재빌드 | `wysiwyg.ts:920-925` (StateField) | `docChanged \|\| tr.selection` 마다 전체 문서 데코레이션 재빌드. 대용량 문서(1000+ 줄)에서 키 입력 지연 유발. 증분 업데이트 (변경된 범위만 재계산) 필요. |

### P-HIGH

| ID  | Issue                          | Location             | Description                                                                                                                         |
| --- | ------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P2  | KaTeX 동기 렌더링 in toDOM()   | `wysiwyg.ts:368-387` | `katex.renderToString()` 위젯 `toDOM()` 내에서 동기 실행. 수학 수식 많은 문서에서 메인 스레드 블로킹. 캐싱 또는 비동기 렌더링 필요. |
| P3  | Mermaid 다이어그램 매번 재렌더 | `wysiwyg.ts:155-190` | 문서 변경 시 모든 Mermaid 위젯 재생성 + 비동기 렌더. 내용 변경 없는 다이어그램도 재렌더. 내용 해시 기반 캐싱 필요.                  |

### P-MEDIUM

| ID  | Issue                         | Location                    | Description                                                                                               |
| --- | ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| P4  | useDocumentStats 매 변경 O(n) | `useDocumentStats.ts:22-27` | 정규식 기반 단어 수 계산이 매 편집마다 전체 문서 스캔. 대용량 문서에서 debounce 추가 또는 증분 계산 필요. |
| P5  | Preview 매번 전체 재파싱      | `MarkdownPreview.tsx`       | content 변경 시 markdown-it 전체 재파싱. debounce는 있으나 증분 파싱 고려 가능.                           |

### P-LOW

| ID  | Issue                   | Location                   | Description                                                   |
| --- | ----------------------- | -------------------------- | ------------------------------------------------------------- |
| P6  | Prism.js 전체 번들 로드 | `wysiwyg.ts` (import)      | 모든 언어 grammars 포함. 사용 언어만 동적 임포트로 전환 가능. |
| P7  | TableWidget DOM 재생성  | `wysiwyg.ts` (TableWidget) | 테이블 위젯이 매번 DOM 전체 재구성. 가상화 또는 캐싱 고려.    |

---

## Priority Roadmap

### Phase 3A (다음 스프린트 — 보안 강화)

1. **S1** Mermaid `'loose'` 옵션 제거 또는 경고 UI
2. **S3+S4** DOMPurify 적용 (markdown-it → preview)
3. **S7** Export HTML sanitization
4. **S2** Custom CSS sanitizer
5. **S10** `npm audit fix`

### Phase 3B (성능 최적화)

1. **P1** WYSIWYG 증분 데코레이션 업데이트
2. **P2** KaTeX 렌더 캐싱
3. **P3** Mermaid 해시 기반 캐싱
4. **P4** Document stats debounce

### Phase 3C (품질 개선)

1. **Q1** Auto-save 경합 조건 수정
2. **Q2** Mermaid 토큰 경합 수정
3. **Q3** Find truncation 사용자 알림
4. **Q4** wysiwyg.ts 모듈 분할
5. **Q8** loadParentDirectory 에러 로깅

### Phase 3D (하우스키핑)

- Q5, Q6, Q9-Q15 및 S8, S9, P5-P7
