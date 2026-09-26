import type { Metadata } from 'next';
import { StockAnalysisLanding } from '@/views/lp';

/** Ad-only page: never indexed, no canonical, alternates or JSON-LD. */
export const metadata: Metadata = {
    title: 'AI 주식 분석 | SIGLENS',
    description:
        '미국 주식과 한국 주식의 차트, 재무, 뉴스, 옵션을 모아 AI가 정리합니다.',
    robots: { index: false, follow: false },
};

export default function StockAnalysisLandingPage() {
    return <StockAnalysisLanding />;
}
