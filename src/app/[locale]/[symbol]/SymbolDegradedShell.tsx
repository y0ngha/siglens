import type { ComponentProps, ReactNode } from 'react';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';

interface SymbolDegradedShellProps extends Pick<
    ComponentProps<typeof CrossLinkCards>,
    'symbol' | 'current' | 'marketProfile'
> {
    /** 페이지의 유일한 `<h1>` 내용(SEO). */
    heading: ReactNode;
    noticeTitle: string;
    noticeBody: string;
    /** 탭의 SEO 스냅샷 프로즈 — 내용이 없으면 렌더러가 스스로 `null`을 반환한다. */
    children: ReactNode;
}

/**
 * 심볼 탭의 degrade 화면 공통 뼈대: h1 하나 → 스냅샷 프로즈 → 일시 장애 안내 →
 * 다른 탭 링크. 데이터 제공자가 복구되는 동안에도 크롤 가능한 본문과 탐색 경로를
 * 남긴다(noindex soft-200은 각 라우트의 `generateMetadata`가 책임진다).
 */
export function SymbolDegradedShell({
    heading,
    noticeTitle,
    noticeBody,
    symbol,
    current,
    marketProfile,
    children,
}: SymbolDegradedShellProps) {
    return (
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>{heading}</SymbolPageHeading>
            {children}
            <section className="rounded-lg border border-secondary-700 bg-secondary-900/40 px-5 py-8 text-center">
                <p className="text-sm font-medium text-secondary-200">
                    {noticeTitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                    {noticeBody}
                </p>
            </section>
            <CrossLinkCards
                symbol={symbol}
                current={current}
                marketProfile={marketProfile}
            />
        </main>
    );
}
