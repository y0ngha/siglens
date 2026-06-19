import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface SymbolPageHeadingProps {
    children: ReactNode;
    className?: string;
}

/**
 * symbol sibling 라우트 5개(뉴스/펀더멘털/옵션/종합/공포탐욕)가 공유하는 가시 h1.
 *
 * RSC-safe 순수 presentational 컴포넌트('use client' 없음)라 app layer의
 * page.tsx(RSC)가 직접 렌더해 SSR HTML에 가시 텍스트로 들어간다. 기존에는
 * 페이지별 h1이 sr-only였는데, 검색엔진이 가시 콘텐츠에 더 가중치를 두므로
 * ticker landing의 텍스트 신호를 살리기 위해 가시 h1으로 노출한다.
 *
 * 차트 라우트(`[symbol]`)는 이 컴포넌트를 쓰지 않는다 — jail(first-viewport 고정
 * + overflow-hidden) 제약상 본문에 블록을 얹을 수 없어, SymbolPageClient의
 * timeframe bar 안에 인라인 h1을 직접 렌더한다.
 *
 * layout breadcrumb(SymbolLayoutHeader)는 모든 페이지 공통이라 의도적으로 heading이
 * 아닌 plain span으로 두므로, 페이지당 가시 h1은 정확히 1개다.
 */
export function SymbolPageHeading({
    children,
    className,
}: SymbolPageHeadingProps) {
    return (
        <h1
            className={cn(
                /*
                 * Intentionally one step smaller than standalone page h1s
                 * (text-2xl sm:text-3xl). Symbol pages render this h1 BELOW the
                 * SymbolLayoutHeader breadcrumb chrome (company name + fear-greed
                 * badge + tab nav), which already establishes the page identity.
                 * Using the same large size as standalone pages would create a
                 * doubled large-title visual — the breadcrumb header acts as the
                 * primary visual anchor, so a smaller h1 keeps the hierarchy correct.
                 */
                'text-secondary-100 text-xl font-bold tracking-tight text-balance sm:text-2xl',
                className
            )}
        >
            {children}
        </h1>
    );
}
