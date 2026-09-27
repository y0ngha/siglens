'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PortfolioSection } from '@/features/portfolio-management';

/**
 * 보유종목 편집 후 서버가 그린 위치 카드 그리드를 다시 읽는다.
 *
 * `?symbol=`(`/[symbol]/position`의 CTA에서 넘어옴)을 추가 폼의 시작 심볼로
 * 채운다. 사이트 전역에서 티커 정규형은 대문자다(proxy.ts 케이스 정규화와 동일
 * 규칙) — 소문자로 들어와도 칩이 정규형으로 보이게 정규화한다. `useSearchParams()`를
 * 쓰므로 이 컴포넌트는 반드시 Suspense 경계 안에서 렌더돼야 한다(그렇지 않으면
 * `/portfolio` 정적 렌더가 통째로 dynamic으로 강등된다).
 */
export function PortfolioManager() {
    const router = useRouter();
    const rawSymbol = useSearchParams().get('symbol');
    const symbol = rawSymbol?.trim().toUpperCase() || undefined;
    return (
        <PortfolioSection
            defaultSymbol={symbol}
            onHoldingsChange={() => router.refresh()}
        />
    );
}
