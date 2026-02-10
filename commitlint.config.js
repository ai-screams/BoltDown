export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],

    'scope-enum': [
      2,
      'always',
      [
        'editor',
        'preview',
        'parser',
        'math',
        'diagram',
        'ui',
        'file',
        'export',
        'config',
        'deps',
        'rust',
        'tauri',
        'ci',
      ],
    ],

    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    'footer-leading-blank': [2, 'always'],
  },
}
