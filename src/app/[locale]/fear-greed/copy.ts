import { FEAR_GREED_LABEL_CUTOFFS } from '@y0ngha/siglens-core';
import { clampSeoDescription, type SeoTranslator } from '@/shared/lib/seo';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';

/**
 * 시장별 공포·탐욕 지수 페이지 카피 — 메타데이터·본문·FAQ의 단일 소스.
 *
 * 미국·한국 라우트가 같은 구조를 그리되 문장만 다르므로, 라우트마다 프로즈를 복사하면
 * 계산식을 바꿀 때 한쪽만 고쳐진다. 특히 한국 쪽은 변동성·신용 요인이 대체 자산으로
 * 채워져 있어서(§FAQ 참조) 그 설명이 화면에서 빠지면 지수가 사실과 다른 말을 하게 된다.
 */
export interface FearGreedCopy {
    /** 라우트 경로. canonical·JSON-LD·breadcrumb가 공유한다. */
    readonly path: string;
    /** Root layout이 `| Siglens`를 붙이므로 브랜드명을 넣지 않는다. */
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    /** breadcrumb 마지막 마디이자 지역 탭 위 h1. */
    readonly heading: string;
    /** h1 아래 설명 문단. */
    readonly intro: readonly string[];
    readonly faq: ReadonlyArray<{ question: string; answer: string }>;
}

/**
 * Score band → `shared.enumLabel` 카탈로그 키(`fearGreed.*`). `FEAR_GREED_LABEL_CUTOFFS`
 * (core)에서 파생하므로 `scoreToLabel`이 실제 쓰는 경계와 절대 어긋나지 않는다.
 * 시장과 무관하게 동일. `labelKey`는 `FearGreedRouteBody`가 `shared.enumLabel`에
 * 바인딩된 번역자로 조회한다 — 원래 `label` 필드는 한글 리터럴이었다.
 */
export const FEAR_GREED_BANDS = [
    {
        labelKey: 'fearGreed.extremeFear',
        min: 0,
        max: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX - 1,
    },
    {
        labelKey: 'fearGreed.fear',
        min: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX - 1,
    },
    {
        labelKey: 'fearGreed.neutral',
        min: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX - 1,
    },
    {
        labelKey: 'fearGreed.greed',
        min: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX - 1,
    },
    {
        labelKey: 'fearGreed.extremeGreed',
        min: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX,
        max: 100,
    },
] as const;

/**
 * `title`/`description`/`heading`은 `shared.seo` 카탈로그에서 온다 — `intro`/`faq`는
 * 계산식을 직접 설명하는 긴 프로즈라 title/description/h1 범위 밖이고(§design
 * "Only titles, descriptions, and the page <h1>s"), `keywords`/`path`도 그대로 둔다.
 */
export function fearGreedCopyFor(
    market: FearGreedMarketId,
    t: SeoTranslator
): FearGreedCopy {
    return FEAR_GREED_COPY[market](t);
}

const US_FEAR_GREED_COPY = (t: SeoTranslator): FearGreedCopy => ({
    path: '/fear-greed',
    title: t('fearGreedPage.us.title'),
    description: clampSeoDescription(t('fearGreedPage.us.description')),
    heading: t('fearGreedPage.us.heading'),
    keywords: [
        '공포 탐욕 지수',
        '시장 심리 지수',
        '미국 증시 심리',
        'Fear and Greed Index',
        'VIX 지수',
        '증시 매수 심리',
    ],
    intro: [
        t('fearGreedPage.us.copy_intro0'),
        t('fearGreedPage.us.copy_intro1'),
    ],
    faq: [
        {
            question: t('fearGreedPage.us.copy_faq0q'),
            answer: t('fearGreedPage.us.copy_faq0a'),
        },
        {
            question: t('fearGreedPage.us.copy_faq1q'),
            answer: t('fearGreedPage.us.copy_faq1a'),
        },
        {
            question: t('fearGreedPage.us.copy_faq2q'),
            answer: t('fearGreedPage.us.copy_faq2a'),
        },
    ],
});

const KR_FEAR_GREED_COPY = (t: SeoTranslator): FearGreedCopy => ({
    path: '/fear-greed/kr',
    title: t('fearGreedPage.kr.title'),
    description: clampSeoDescription(t('fearGreedPage.kr.description')),
    heading: t('fearGreedPage.kr.heading'),
    keywords: [
        '코스피 공포 탐욕 지수',
        '한국 증시 심리',
        '국내 증시 투자심리',
        '코스피 심리 지수',
        '공포 탐욕 지수',
        '증시 매수 심리',
    ],
    intro: [
        t('fearGreedPage.kr.copy_intro0'),
        t('fearGreedPage.kr.copy_intro1'),
    ],
    faq: [
        {
            question: t('fearGreedPage.kr.copy_faq0q'),
            answer: t('fearGreedPage.kr.copy_faq0a'),
        },
        {
            question: t('fearGreedPage.kr.copy_faq1q'),
            answer: t('fearGreedPage.kr.copy_faq1a'),
        },
        {
            question: t('fearGreedPage.kr.copy_faq2q'),
            answer: t('fearGreedPage.kr.copy_faq2a'),
        },
        {
            question: t('fearGreedPage.kr.copy_faq3q'),
            answer: t('fearGreedPage.kr.copy_faq3a'),
        },
    ],
});

/**
 * 암호화폐. FAQ가 반드시 밝혀야 하는 다섯 가지(설계 문서 §Copy): alternative.me와 다른
 * 점(소셜·설문 없음), 오늘의 대형 코인 목록이라 생기는 생존 편향, 코인 7일·금 5일
 * 달력 차이, 00:00 UTC 기준 일 1회 갱신, 투자 조언 아님.
 */
const CRYPTO_FEAR_GREED_COPY = (t: SeoTranslator): FearGreedCopy => ({
    path: '/fear-greed/crypto',
    title: t('fearGreedPage.crypto.title'),
    description: clampSeoDescription(t('fearGreedPage.crypto.description')),
    heading: t('fearGreedPage.crypto.heading'),
    keywords: [
        '코인 공포탐욕지수',
        '코인 공포지수',
        '코인 탐욕지수',
        '크립토 공포지수',
        '암호화폐 공포탐욕지수',
        '비트코인 공포탐욕지수',
        'crypto fear and greed index',
    ],
    intro: [
        t('fearGreedPage.crypto.copy_intro0'),
        t('fearGreedPage.crypto.copy_intro1'),
    ],
    faq: [
        {
            question: t('fearGreedPage.crypto.copy_faq0q'),
            answer: t('fearGreedPage.crypto.copy_faq0a'),
        },
        {
            question: t('fearGreedPage.crypto.copy_faq1q'),
            answer: t('fearGreedPage.crypto.copy_faq1a'),
        },
        {
            question: t('fearGreedPage.crypto.copy_faq2q'),
            answer: t('fearGreedPage.crypto.copy_faq2a'),
        },
        {
            question: t('fearGreedPage.crypto.copy_faq3q'),
            answer: t('fearGreedPage.crypto.copy_faq3a'),
        },
        {
            question: t('fearGreedPage.crypto.copy_faq4q'),
            answer: t('fearGreedPage.crypto.copy_faq4a'),
        },
    ],
});

const FEAR_GREED_COPY: Record<
    FearGreedMarketId,
    (t: SeoTranslator) => FearGreedCopy
> = {
    us: US_FEAR_GREED_COPY,
    kr: KR_FEAR_GREED_COPY,
    crypto: CRYPTO_FEAR_GREED_COPY,
};
