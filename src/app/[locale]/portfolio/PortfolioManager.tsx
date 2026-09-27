'use client';

import { useRouter } from 'next/navigation';
import { PortfolioSection } from '@/features/portfolio-management';

/** 보유종목 편집 후 서버가 그린 위치 카드 그리드를 다시 읽는다. */
export function PortfolioManager() {
    const router = useRouter();
    return <PortfolioSection onHoldingsChange={() => router.refresh()} />;
}
