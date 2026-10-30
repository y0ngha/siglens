import type { ReactNode } from 'react';

interface LegalPageFrameProps {
    /** 문서 위 브레드크럼. 진입 파일이 그려 넘긴다(이 파일은 상위 컴포넌트를 모른다). */
    readonly breadcrumb: ReactNode;
    /** 제목 위 작은 영문 라벨. */
    readonly eyebrow: string;
    /** 페이지의 유일한 h1. */
    readonly title: string;
    /** 제목 아래 머리말 영역(소개·시행일). */
    readonly headerExtra?: ReactNode;
    readonly children: ReactNode;
}

/**
 * 약관·개인정보처리방침 페이지 공통 골격: `<main>` 랜드마크, 문서 `<article>`,
 * 브레드크럼, eyebrow + h1 머리말. 본문 셸과 불러오기 실패 안내가 같은 골격을 쓴다.
 */
export function LegalPageFrame({
    breadcrumb,
    eyebrow,
    title,
    headerExtra,
    children,
}: LegalPageFrameProps) {
    return (
        <main className="page-container flex flex-1 flex-col items-center py-12 sm:py-16">
            <article className="w-full max-w-3xl">
                {breadcrumb}

                <header className="border-b border-secondary-700 pb-8">
                    <p className="font-mono text-xs tracking-widest text-primary-400 uppercase">
                        {eyebrow}
                    </p>
                    <h1 className="mt-3 text-3xl font-bold text-secondary-50 sm:text-4xl">
                        {title}
                    </h1>
                    {headerExtra}
                </header>

                {children}
            </article>
        </main>
    );
}
