export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type 규칙
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 새 기능
        'fix',      // 버그 수정
        'docs',     // 문서 변경
        'style',    // 코드 스타일 (formatting, missing semi-colons, etc)
        'refactor', // 리팩토링
        'perf',     // 성능 개선
        'test',     // 테스트 추가/수정
        'build',    // 빌드 시스템 변경
        'ci',       // CI 설정 변경
        'chore',    // 기타 (dependencies, etc)
        'revert',   // 커밋 되돌리기
      ],
    ],

    // Scope 규칙 (선택적)
    'scope-enum': [
      2,
      'always',
      [
        'editor',      // CodeMirror 에디터
        'preview',     // Markdown 미리보기
        'parser',      // markdown-it 파서
        'math',        // KaTeX 수학
        'diagram',     // Mermaid 다이어그램
        'ui',          // UI 컴포넌트
        'file',        // 파일 시스템
        'export',      // PDF/HTML export
        'config',      // 설정
        'deps',        // 의존성
        'rust',        // Rust 백엔드
        'tauri',       // Tauri 프레임워크
      ],
    ],

    // Subject 규칙
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // Body 규칙
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer 규칙
    'footer-leading-blank': [2, 'always'],
  },
}
