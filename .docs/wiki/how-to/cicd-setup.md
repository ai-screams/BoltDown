# CI/CD Setup - BoltDown

> **작성일**: 2026-02-10
> **목적**: 최소한의 CI/CD 파이프라인 (Lint, CVE, Secret, Test)

---

## Overview

**비유**: CI/CD는 **전기차 품질 관리 시스템**이다.

- **Lint**: 결함 감지 센서 (타입 오류, 버그 패턴)
- **CVE**: 부품 리콜 알림 (취약한 의존성)
- **Secret**: 비밀번호 노출 경보 (API 키 유출)
- **Test**: 주행 테스트 (기능 검증)
- **Build**: 조립 검증 (컴파일 확인)

---

## CI/CD Stack (Best Practice)

### 선정 기준

| 도구            | 속도       | 정확도     | CI 통합    | 무료 | 선정 |
| --------------- | ---------- | ---------- | ---------- | ---- | ---- |
| **ESLint v9**   | ⚡⚡⚡     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **Prettier**    | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **npm audit**   | ⚡⚡⚡⚡   | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **cargo audit** | ⚡⚡⚡⚡   | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **Dependabot**  | ⚡⚡⚡     | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **Gitleaks**    | ⚡⚡⚡⚡⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **TruffleHog**  | ⚡⚡       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ✅   | 🔶   |
| **Vitest**      | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅   | ✅   |
| **Playwright**  | ⚡⚡⚡⚡   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅   | ✅   |

### 최종 선정

```
Lint:    ESLint + Prettier + clippy
CVE:     npm audit + cargo audit + Dependabot
Secret:  Gitleaks
Test:    Vitest + Playwright + cargo test
Platform: GitHub Actions
```

---

## 1. GitHub Actions Workflow

### 파일: `.github/workflows/ci.yml`

**4개 Job (병렬 실행)**:

```
┌─────────────────────────────────────┐
│  Job 1: Lint & Format (1-2분)       │
│  ├─ TypeScript type check           │
│  ├─ ESLint                          │
│  ├─ Prettier                        │
│  ├─ cargo fmt                       │
│  └─ cargo clippy                    │
└─────────────────────────────────────┘
         ↓ (병렬)
┌─────────────────────────────────────┐
│  Job 2: Security (2-3분)            │
│  ├─ npm audit (CVE)                 │
│  ├─ cargo audit (CVE)               │
│  └─ Gitleaks (Secret)               │
└─────────────────────────────────────┘
         ↓ (lint 통과 후)
┌─────────────────────────────────────┐
│  Job 3: Test (5분)                  │
│  ├─ Vitest (unit)                   │
│  ├─ Playwright (E2E)                │
│  └─ cargo test                      │
└─────────────────────────────────────┘
         ↓ (lint 통과 후)
┌─────────────────────────────────────┐
│  Job 4: Build (5-10분)              │
│  ├─ Matrix: ubuntu, macos, windows  │
│  ├─ npm build                       │
│  └─ cargo build                     │
└─────────────────────────────────────┘
```

**총 실행 시간**: ~5-10분 (병렬 실행)

---

## 2. Dependabot

### 파일: `.github/dependabot.yml`

**자동 업데이트** (주간):

- npm 패키지 (매주 월요일 09:00 KST)
- Cargo 크레이트 (매주 월요일 09:00 KST)
- GitHub Actions (매월)

**Grouping** (관련 패키지 묶음):

- `react-ecosystem`: react, react-dom, @types/react\*
- `vite-ecosystem`: vite, @vitejs/\*
- `eslint-ecosystem`: eslint*, @typescript-eslint/*
- `codemirror-ecosystem`: @codemirror/\*
- `tauri-ecosystem`: tauri\*

**자동 PR 생성**:

```
chore(deps): bump react from 18.3.1 to 18.3.2

Updates react from 18.3.1 to 18.3.2
- Changelog: https://...
- Commits: https://...
```

---

## 3. Gitleaks (Secret Detection)

### 왜 Gitleaks인가?

| Feature          | Gitleaks        | TruffleHog      |
| ---------------- | --------------- | --------------- |
| **속도**         | ⚡⚡⚡⚡⚡ 빠름 | ⚡⚡ 느림       |
| **탐지율**       | ⭐⭐⭐⭐ 높음   | ⭐⭐⭐⭐⭐ 최고 |
| **CI 통합**      | ⭐⭐⭐⭐⭐ 쉬움 | ⭐⭐⭐ 복잡     |
| **커스터마이징** | ⭐⭐⭐⭐⭐      | ⭐⭐⭐          |
| **리소스**       | 적음            | 많음            |

**결론**: Gitleaks (빠르고, CI 친화적)

**출처**: [TruffleHog vs. Gitleaks Comparison](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools)

### 탐지 대상

- API 키 (AWS, Google, GitHub 등)
- Private keys (RSA, SSH)
- Passwords
- Tokens (JWT, OAuth)
- Database credentials

### False Positive 제외

**`.gitleaksignore`**:

```
# Documentation examples (safe)
.docs/**/*.md:generic-api-key

# Package locks (hashes, not secrets)
package-lock.json:*
Cargo.lock:*
```

---

## 4. CVE Scanning

### npm audit

**장점**:

- ✅ 내장 (설치 불필요)
- ✅ 빠름
- ✅ npm registry 기반

**단점**:

- ⚠️ False positive 많음
- ⚠️ Alert fatigue

**사용**:

```bash
# Local
npm audit

# CI
npm audit --audit-level=moderate  # moderate 이상만
```

**출처**: [NPM Security Audit Guide](https://www.aikido.dev/blog/npm-audit-guide)

### cargo audit

**RustSec Advisory Database** 기반

**설치**:

```bash
cargo install cargo-audit --locked
```

**사용**:

```bash
cd src-tauri
cargo audit
```

### Dependabot

**자동화**:

- ✅ 취약점 발견 시 자동 PR
- ✅ 버전 업데이트 제안
- ✅ GitHub Security Advisory 통합

**출처**: [Dependabot Security Updates](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates)

---

## 5. Testing

### Vitest (Unit Tests)

**왜 Vitest인가?**:

- ✅ Vite 네이티브 (설정 최소)
- ✅ Jest API 호환 (migration 쉬움)
- ✅ 빠름 (Vite HMR 활용)
- ✅ Browser Mode (Playwright 통합)

**설정**: `vitest.config.ts`

**예시**:

```typescript
// src/utils/markdown.test.ts
import { describe, it, expect } from 'vitest'
import { wordCount } from './markdown'

describe('wordCount', () => {
  it('should count words correctly', () => {
    expect(wordCount('Hello BoltDown')).toBe(2)
  })
})
```

**실행**:

```bash
# Watch mode
npm run test

# Run once (CI)
npm run test:run

# Coverage
npm run test:coverage
```

**출처**: [Vitest Guide](https://vitest.dev/guide/)

### Playwright (E2E Tests)

**Browser automation**:

- ✅ Chromium, Firefox, WebKit 지원
- ✅ Headless 모드 (CI)
- ✅ 스크린샷, 비디오 녹화

**설정**: `playwright.config.ts`

**예시**:

```typescript
// tests/e2e/editor.spec.ts
import { test, expect } from '@playwright/test'

test('should render editor', async ({ page }) => {
  await page.goto('http://localhost:5173')

  await expect(page.locator('h1')).toContainText('BoltDown')
})
```

**실행**:

```bash
# Headless
npm run test:e2e

# UI mode
npm run test:e2e:ui
```

**출처**: [Vitest + Playwright Setup](https://dev.to/juan_deto/configure-vitest-msw-and-playwright-in-a-react-project-with-vite-and-ts-part-3-32pe)

### cargo test (Backend)

**이미 구현됨**: `src-tauri/src/lib.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_word_count() {
        assert_eq!(utils::word_count("Hello BoltDown"), 2);
    }
}
```

**실행**:

```bash
npm run rust:test
```

---

## 6. CI Workflow 상세

### Job 1: Lint & Format

**실행 조건**: 모든 push, PR

**Steps**:

1. Checkout
2. Setup Node.js (with npm cache)
3. Setup Rust (with cargo cache)
4. Install deps
5. Type check
6. ESLint
7. Prettier check
8. cargo fmt check
9. cargo clippy

**실행 시간**: ~1-2분

**캐싱**:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cargo/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

---

### Job 2: Security

**CVE Scanning**:

```bash
npm audit --audit-level=moderate  # Moderate 이상
cargo audit                       # RustSec DB
```

**Secret Scanning**:

```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**continue-on-error: true** → 실패해도 빌드 중단 안 함 (경고만)

---

### Job 3: Test

**needs: lint** → Lint 통과 후 실행 (빠른 실패)

**Frontend**:

```bash
npm run test:run         # Vitest
npm run test:e2e         # Playwright (skip for now)
```

**Backend**:

```bash
cargo test
```

---

### Job 4: Build

**Matrix Strategy** (3 OS 병렬):

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
```

**macOS 산출물 업로드**:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: boltdown-macos
    path: src-tauri/target/release/bundle/dmg/*.dmg
```

---

## 7. Dependabot 상세

### 자동 PR 생성

**주간 업데이트** (월요일 09:00 KST):

- npm 패키지 검사
- Cargo 크레이트 검사
- 새 버전 있으면 PR 생성

**Grouping** (묶음 업데이트):

```yaml
groups:
  react-ecosystem:
    patterns:
      - 'react*'
      - '@types/react*'
```

**결과**: 1개 PR로 react + react-dom + @types/react 통합 업데이트

---

## 8. Local Testing

### CI 실행 전 로컬 검증

```bash
# 전체 검증 (CI와 동일)
npm run validate

# 결과:
# ✔ TypeScript type check
# ✔ ESLint
# ✔ Prettier
# ✔ cargo fmt
# ✔ cargo clippy

# CVE 검사
npm audit
cd src-tauri && cargo audit

# Secret 검사 (로컬)
docker run -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v

# 테스트
npm run test:run
npm run rust:test
```

---

## 9. CI/CD 파이프라인 흐름

```
┌───────────────────┐
│  Git Push/PR      │
└─────────┬─────────┘
          ↓
┌─────────────────────────────────┐
│  Job 1: Lint (병렬)              │
│  ├─ Type check (1분)             │
│  ├─ ESLint (30초)                │
│  ├─ Prettier (10초)              │
│  └─ cargo fmt + clippy (1분)     │
│  Total: ~2분                     │
└─────────┬───────────────────────┘
          ├────────────────┐
          ↓                ↓
┌──────────────────┐  ┌──────────────────┐
│  Job 2: Security │  │  Job 3: Test     │
│  (병렬)          │  │  (lint 후)       │
│  ├─ npm audit    │  │  ├─ Vitest       │
│  ├─ cargo audit  │  │  ├─ Playwright   │
│  └─ Gitleaks     │  │  └─ cargo test   │
│  Total: ~2분     │  │  Total: ~5분     │
└──────────────────┘  └─────────┬────────┘
          ↓                      ↓
┌─────────────────────────────────┐
│  Job 4: Build (lint 후, 병렬)    │
│  ├─ ubuntu (5분)                 │
│  ├─ macos (7분)                  │
│  └─ windows (8분)                │
│  Total: ~8분 (병렬)              │
└─────────────────────────────────┘
          ↓
    ✅ All Passed
```

**총 실행 시간**: ~8-10분 (병렬 실행)

---

## 10. Best Practices

### ✅ Do

1. **Fail Fast** - Lint 먼저, 실패하면 즉시 중단
2. **Caching** - node_modules, cargo 캐싱 (2-3배 속도 향상)
3. **Parallel** - 독립적인 job 병렬 실행
4. **Matrix** - 여러 OS 동시 테스트
5. **Artifacts** - 빌드 산출물 업로드 (macOS DMG)

### ❌ Don't

1. ❌ 모든 job 순차 실행 (느림)
2. ❌ 캐싱 없음 (매번 설치)
3. ❌ npm audit --force (breaking changes)
4. ❌ Secret을 .env에 commit (Gitleaks가 잡음)

---

## 11. 비교: Gitleaks vs TruffleHog

### Gitleaks (선정) ✅

**장점**:

- ⚡ 빠름 (경량)
- 🔧 커스터마이징 쉬움 (.gitleaksignore)
- 🚀 CI 통합 쉬움 (GitHub Action 공식 지원)
- 📊 많은 secrets 탐지

**단점**:

- 🔍 Classification 약함 (TruffleHog보다)
- 📦 코드만 스캔 (Docker, Cloud 미지원)

**출처**: [Secret Scanner Comparison](https://medium.com/@navinwork21/secret-scanner-comparison-finding-your-best-tool-ed899541b9b6)

### TruffleHog (대안) 🔶

**장점**:

- 🔍 심층 스캔 (historical commits)
- 📦 Docker, Cloud 지원
- 🎯 Classification 우수

**단점**:

- 🐢 느림 (리소스 많이 사용)
- 🛠️ 설정 복잡
- 💰 상용 기능 (TruffleHog Enterprise)

**결론**: **Gitleaks가 BoltDown에 적합** (빠르고 CI 친화적)

---

## 12. 비교: npm audit vs Snyk

| Feature     | npm audit  | Snyk        |
| ----------- | ---------- | ----------- |
| **무료**    | ✅         | ⚠️ (제한적) |
| **속도**    | ⚡⚡⚡⚡   | ⚡⚡⚡      |
| **정확도**  | ⭐⭐⭐     | ⭐⭐⭐⭐⭐  |
| **자동 PR** | ❌         | ✅          |
| **CI 통합** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐    |

**권장**: **npm audit + Dependabot** (무료, 충분함)

**Snyk는 Phase 3에 고려** (상용 필요시)

**출처**: [NPM Audit Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html)

---

## 13. Test 전략 (준비)

### Unit Tests (Vitest)

**대상**:

- Utils (markdown.ts, katex.ts)
- Hooks (useMarkdown.ts)
- Stores (editorStore.ts)

**Coverage 목표**: 80%

### Component Tests (Vitest Browser Mode)

**대상**:

- Editor component
- Preview component
- Toolbar component

**Playwright로 실제 브라우저 테스트**

### E2E Tests (Playwright)

**시나리오**:

1. 앱 오픈 → "BoltDown" 표시 확인
2. Markdown 입력 → 실시간 미리보기 확인
3. PDF export → 파일 생성 확인

**출처**: [Component Testing with Playwright and Vitest](https://www.thecandidstartup.org/2025/01/06/component-test-playwright-vitest.html)

---

## 14. 로컬 명령어

### Pre-commit 수동 실행

```bash
# Staged 파일만 검사
npx lint-staged
```

### CI 시뮬레이션 (로컬)

```bash
# 1. Lint
npm run validate

# 2. Security
npm audit
cd src-tauri && cargo audit
docker run -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path"

# 3. Test
npm run test:run
npm run test:e2e
npm run rust:test

# 4. Build
npm run build
npm run tauri:build
```

---

## 15. GitHub Secrets (필요시)

### 설정 위치

**Repository Settings → Secrets and variables → Actions**

### 필요한 Secrets (미래)

| Secret                      | 용도                 | 예시      |
| --------------------------- | -------------------- | --------- |
| `TAURI_SIGNING_PRIVATE_KEY` | macOS/Windows 서명   | (Phase 3) |
| `APPLE_CERTIFICATE`         | macOS notarization   | (Phase 3) |
| `WINDOWS_CERTIFICATE`       | Windows code signing | (Phase 3) |

**현재**: 불필요 (기본 빌드만)

---

## 16. 참고 자료

### GitHub Actions

- [GitHub Actions Best Practices](https://www.infinyon.com/blog/2021/04/github-actions-best-practices/)
- [Rust CI/CD with GitHub Actions](https://github.com/BamPeers/rust-ci-github-actions-workflow)

### Security

- [Gitleaks vs TruffleHog](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools)
- [npm audit Guide](https://www.aikido.dev/blog/npm-audit-guide)
- [Dependabot Docs](https://docs.github.com/en/code-security/dependabot)

### Testing

- [Vitest + Playwright](https://dev.to/juan_deto/configure-vitest-msw-and-playwright-in-a-react-project-with-vite-and-ts-part-3-32pe)
- [Component Testing](https://www.thecandidstartup.org/2025/01/06/component-test-playwright-vitest.html)

---

**"전기차도 품질 검수를 거친다. CI/CD로 버그를 출고 전에 잡는다."** ⚡
