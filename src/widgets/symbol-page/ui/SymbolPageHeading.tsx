import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface SymbolPageHeadingProps {
    children: ReactNode;
    className?: string;
}

/**
 * symbol 라우트 6개(차트/뉴스/펀더멘털/옵션/종합/공포탐욕)가 공유하는 가시 h1.
 *
 * RSC-safe 순수 presentational 컴포넌트('use client' 없음)라 app layer의
 * page.tsx(RSC)가 직접 렌더해 SSR HTML에 가시 텍스트로 들어간다. 기존에는
 * 페이지별 h1이 sr-only였는데, 검색엔진이 가시 콘텐츠에 더 가중치를 두므로
 * ticker landing의 텍스트 신호를 살리기 위해 가시 h1으로 노출한다.
 *
 * layout breadcrumb(SymbolLayoutHeader)는 6개 페이지 공통이라 의도적으로
 * heading이 아닌 plain span으로 두므로, 페이지당 가시 h1은 이 컴포넌트 1개뿐이다.
 */
export function SymbolPageHeading({
    children,
    className,
}: SymbolPageHeadingProps) {
    return (
        <h1
            className={cn(
                'text-secondary-100 text-xl font-bold tracking-tight text-balance sm:text-2xl',
                className
            )}
        >
            {children}
        </h1>
    );
}
