// .prettierrc.cjs

module.exports = {
    // [공통 포맷팅 규칙]
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: true, // TS/JS/SCSS 문자열 모두 작은 따옴표 사용
    trailingComma: 'es5',
    arrowParens: 'avoid',
    printWidth: 80,
    endOfLine: 'lf',

    // [Tailwind CSS 클래스 정렬 플러그인]
    // **중요:** 확장 프로그램 충돌을 피하기 위해 직접 require 대신 플러그인 이름 문자열을 사용합니다.
    plugins: ['prettier-plugin-tailwindcss'],

    // [SCSS 관련 오버라이드]
    overrides: [
        {
            files: '*.scss',
            options: {
                // ...
            },
        },
        {
            files: '*.{ts,tsx}',
            options: {
                // ...
            },
        },
    ],
};
