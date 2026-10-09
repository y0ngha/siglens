'use client';

import { useRouter } from 'next/navigation';
import { WatchlistSection } from '@/features/watchlist/ui/WatchlistSection';

/** "보유로 전환"이 성공하면 서버가 그린 보유 카드 그리드를 다시 읽는다(`PortfolioManager`와 같은 이유). */
export function WatchlistManager() {
    const router = useRouter();
    return <WatchlistSection onHoldingsChange={() => router.refresh()} />;
}
