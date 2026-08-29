/**
 * i18n 프로바이더 **없이** 렌더한다.
 *
 * `vitest.setup.dom.ts`가 모든 `render`를 `NextIntlClientProvider`로 감싸는데,
 * 그건 프로덕션에 없는 프로바이더를 모든 컴포넌트에 쥐여주는 것이기도 하다.
 * 그래서 `global-error.tsx`처럼 **정의상 프로바이더 바깥에서 도는 컴포넌트**의
 * 파손을 어떤 테스트도 감지할 수 없었다 — `useTranslations`를 넣어도 5개 테스트가
 * 전부 통과했고, 프로덕션에서는 최후의 에러 경계가 던졌을 것이다.
 *
 * 프로바이더 바깥에서 도는 컴포넌트는 반드시 이걸로 렌더한다.
 */
const actual = await vi.importActual<typeof import('@testing-library/react')>(
    '@testing-library/react'
);

export const renderWithoutIntl = actual.render;
