import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import type { SeoTranslator } from '@/shared/lib/seo';

/** 종목이 속한 시장의 공포·탐욕 허브 링크. 문구는 `app.symbol` 번역자로 꺼낸다. */
export interface MarketFearGreedLink {
    /** 로케일 접두사 없는 앱 경로 — `LocaleLink`가 붙인다. */
    readonly href: string;
    /** 링크 문구(예: "시장 전체 공포·탐욕 지수"). */
    readonly label: (t: SeoTranslator) => string;
    /** 시장 이름(예: "미국 증시") — 본문 문장과 시장 판독 요약에 함께 쓴다. */
    readonly marketLabel: (t: SeoTranslator) => string;
}

/**
 * 시장별 상위 공포·탐욕 지수 링크 — 세 시장 모두 자기 허브(`/fear-greed`, `/fear-greed/kr`,
 * `/fear-greed/crypto`)를 가리킨다. 한국 종목이 미국 증시 전반을 참조하면 문장이 틀린다.
 *
 * 문구는 카탈로그 키로 들고 있는다 — 문자열을 박아 두면 영어 페이지 문장 한가운데 한국어 시장명이
 * 나간다. 키는 리터럴 호출로 둬 카탈로그 추출이 사용처를 본다.
 */
export const MARKET_FEAR_GREED_LINK: Readonly<
    Record<MarketProfileId, MarketFearGreedLink>
> = {
    'us-equity': {
        href: '/fear-greed',
        label: t => t('page.marketFearGreedLinkAll'),
        marketLabel: t => t('page.marketLabelUs'),
    },
    'kr-equity': {
        href: '/fear-greed/kr',
        label: t => t('page.marketFearGreedLinkKr'),
        marketLabel: t => t('page.marketLabelKr'),
    },
    crypto: {
        href: '/fear-greed/crypto',
        label: t => t('page.marketFearGreedLinkCrypto'),
        marketLabel: t => t('page.marketLabelCrypto'),
    },
};
