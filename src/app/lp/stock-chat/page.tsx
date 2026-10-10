import type { Metadata } from 'next';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { StockChatLanding } from '@/views/lp/StockChatLanding';

/** Ad-only page: never indexed, no canonical, alternates or JSON-LD. */
export const metadata: Metadata = {
    // 한국어 전용 광고 페이지 — 기본 로케일(ko) 접미사 `| 시그렌즈`.
    title: brandTitle('주식 전용 AI 챗봇', DEFAULT_LOCALE),
    description:
        '시세와 차트를 직접 조회하고 출처와 기준 시각을 함께 알려주는 주식 전용 AI 챗봇입니다.',
    robots: { index: false, follow: false },
};

export default function StockChatLandingPage() {
    return <StockChatLanding />;
}
