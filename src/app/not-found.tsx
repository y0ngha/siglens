/* eslint-disable nextjs/no-html-link-for-pages --
 * 아래 홈 링크는 `<Link>`가 아니라 `<a>`여야 한다. 이 파일은 루트 레이아웃
 * 바깥에서 자체 문서를 렌더하는 자리라 앱 라우터 컨텍스트가 없고, 전체 페이지
 * 로드로 앱을 처음부터 세우는 것이 유일하게 정상 동작하는 경로다. */
import type { Metadata } from 'next';
import './globals.css';

/**
 * 루트 레이아웃 바깥이라 로케일을 알 수 없다 — `global-error.tsx`와 같은 이유로
 * ko·en 병기다. 제목 자체가 없으면 브라우저 탭과 크롤러가 URL을 그대로 보여준다.
 */
export const metadata: Metadata = {
    title: '페이지를 찾을 수 없습니다 / Page not found',
    robots: { index: false, follow: true },
};

/**
 * 루트 404.
 *
 * ## 왜 필요한가
 *
 * 전 라우트가 `[locale]/` 아래로 이동하면서 `src/app/layout.tsx`가 사라졌다.
 * 그러면 **어떤 라우트에도 매칭되지 않은 URL**은 로케일 레이아웃 바깥에서
 * 처리되고, Next의 내부 셸(`<html id="__next_error__">`, `lang` 없음, 본문 없음)이
 * 뜬다. 실측: `/nonexistent-page-xyz`, `/ZZZZZZZZZ`, `/en/nonexistent-page-xyz`가
 * 전부 제목만 있고 본문이 비어 있었다 — **한국어 사용자 포함 모든 404**가
 * 그랬고, 상태 코드는 404로 정확했기 때문에 상태만 검사하는 테스트로는 안 보였다.
 *
 * 루트 레이아웃이 없으므로 이 파일이 `<html>`·`<body>`와 스타일시트를 직접 맡는다
 * (`global-error.tsx`와 같은 이유). 로케일을 알 수 없는 자리라 한국어·영어를
 * 병기하고, 링크는 전체 페이지 로드가 되도록 맨 `<a>`를 쓴다.
 */
export default function RootNotFound() {
    return (
        <html lang="ko">
            <body className="flex min-h-dvh flex-col items-center justify-center bg-secondary-900 px-6 text-center text-secondary-50">
                <p className="font-mono text-sm tracking-widest text-primary-400">
                    404
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100">
                    페이지를 찾을 수 없습니다
                    <span className="mt-1 block text-lg font-medium text-secondary-300">
                        Page not found
                    </span>
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    주소가 바뀌었거나 삭제된 페이지입니다.
                    <span className="mt-1 block">
                        The page may have moved or been removed.
                    </span>
                </p>
                <a
                    href="/"
                    className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                    홈으로 / Home
                </a>
            </body>
        </html>
    );
}
