'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PortfolioSection } from '@/features/portfolio-management/ui/PortfolioSection';

/**
 * 보유종목 관리 폼. 편집 뒤 `router.refresh()`로 서버가 그린 위치 카드 그리드를 다시 읽는다.
 *
 * `?symbol=`(`/[symbol]/position`의 CTA에서 넘어옴)을 추가 폼의 시작 심볼로 채운다. 사이트
 * 전역에서 티커 정규형은 대문자다(proxy.ts 케이스 정규화와 같은 규칙) — 소문자로 들어와도 칩이
 * 정규형으로 보이게 정규화한다. `useSearchParams()`를 쓰므로 Suspense 경계 안에서 렌더한다 —
 * 정적 렌더에서는 가장 가까운 경계까지 CSR로 떨어지므로 그 범위를 이 폼으로 한정한다.
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
