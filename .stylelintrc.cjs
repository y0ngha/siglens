// .stylelintrc.cjs
// SCSS 제거. Tailwind CSS 전용.

module.exports = {
    extends: ['stylelint-config-standard', 'stylelint-config-recess-order'],

    plugins: ['stylelint-order'],

    rules: {
        // Tailwind 지시어 허용 (@tailwind, @apply, @layer, @theme 등)
        'at-rule-no-unknown': [
            true,
            {
                ignoreAtRules: [
                    'tailwind',
                    'apply',
                    'variants',
                    'screen',
                    'layer',
                    'theme',
                    'config',
                ],
            },
        ],

        // Tailwind의 :global, :local 허용
        'selector-pseudo-class-no-unknown': [
            true,
            {
                ignorePseudoClasses: ['global', 'local'],
            },
        ],

        // CSS Modules camelCase 허용
        'selector-class-pattern': null,

        'rule-empty-line-before': [
            'always',
            {
                except: ['first-nested'],
                ignore: ['after-comment'],
            },
        ],
    },

    ignoreFiles: [
        '**/*.js',
        '**/*.ts',
        '**/*.tsx',
        '**/*.json',
        '**/*.md',
        '**/.next/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/coverage/**',
    ],
};
