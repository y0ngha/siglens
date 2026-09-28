import type { Metadata } from 'next';
import { StockChatLanding } from '@/views/lp';

/** Ad-only page: never indexed, no canonical, alternates or JSON-LD. */
export const metadata: Metadata = {
    title: '주식 전용 AI 챗봇 | SIGLENS',
    description:
        '시세와 차트를 직접 조회하고 출처와 기준 시각을 함께 알려주는 주식 전용 AI 챗봇입니다.',
    robots: { index: false, follow: false },
};

export default function StockChatLandingPage() {
    return <StockChatLanding />;
}
