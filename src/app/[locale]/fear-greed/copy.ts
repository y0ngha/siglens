import { FEAR_GREED_LABEL_CUTOFFS } from '@y0ngha/siglens-core';
import { clampSeoDescription } from '@/shared/lib/seo';
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
 * Score band → Korean label. `FEAR_GREED_LABEL_CUTOFFS`(core)에서 파생하므로
 * `scoreToLabel`이 실제 쓰는 경계와 절대 어긋나지 않는다. 시장과 무관하게 동일.
 */
export const FEAR_GREED_BANDS = [
    {
        label: '극심한 공포',
        min: 0,
        max: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX - 1,
    },
    {
        label: '공포',
        min: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX - 1,
    },
    {
        label: '중립',
        min: FEAR_GREED_LABEL_CUTOFFS.FEAR_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX - 1,
    },
    {
        label: '탐욕',
        min: FEAR_GREED_LABEL_CUTOFFS.NEUTRAL_MAX,
        max: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX - 1,
    },
    {
        label: '극심한 탐욕',
        min: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX,
        max: 100,
    },
] as const;

export const FEAR_GREED_COPY: Record<FearGreedMarketId, FearGreedCopy> = {
    us: {
        path: '/fear-greed',
        title: '오늘 미국 증시 심리, 공포 탐욕 지수로 확인',
        description: clampSeoDescription(
            'S&P500·VIX·장기국채·회사채·동일가중 지수의 최근 흐름을 묶어 미국 증시 전체의 매수 심리를 0~100 점수와 5단계 라벨로 보여줍니다.'
        ),
        keywords: [
            '공포 탐욕 지수',
            '시장 심리 지수',
            '미국 증시 심리',
            'Fear and Greed Index',
            'VIX 지수',
            '증시 매수 심리',
        ],
        heading: '미국 공포·탐욕 지수',
        intro: [
            '시장 공포 탐욕 지수는 S&P500, VIX, 장기국채, 회사채(하이일드·투자등급), 동일가중 지수의 최근 종가 흐름을 묶어 미국 증시 전체의 단기 매수 심리를 0~100 점수로 나타냅니다.',
            '5개 요인을 각각 과거 분포 안에서 백분위로 환산한 뒤 동일 가중으로 평균해 산출하며, 점수가 낮을수록 공포, 높을수록 탐욕 심리가 강하다는 뜻입니다.',
        ],
        faq: [
            {
                question: '시장 공포 탐욕 지수는 무엇을 측정하나요?',
                answer: 'S&P500·VIX·장기국채·하이일드/투자등급 회사채·동일가중 지수, 5개 요인의 최근 종가 흐름을 묶어 미국 증시 전체의 단기 매수 심리를 0~100 점수로 나타냅니다.',
            },
            {
                question: 'CNN의 Fear & Greed Index와 같은 지수인가요?',
                answer: '이 지수는 CNN과는 독립적으로, 일별 종가 데이터만으로 자체 5개 요인(모멘텀·변동성·안전자산 선호·정크본드 수요·시장 폭)을 산출해 계산합니다. 옵션 Put/Call 비율 등 CNN이 쓰는 일부 지표는 포함하지 않으므로 공포·탐욕의 방향은 대체로 비슷하게 움직이지만, 계산 방식(construction)이 달라 정확한 점수는 CNN 지수와 일치하지 않습니다.',
            },
            {
                question: '점수는 얼마나 자주 갱신되나요?',
                answer: '정규장 마감 종가를 기준으로 세션 단위(하루 한 번)로 갱신되며, 페이지 자체는 최대 1시간 캐시됩니다.',
            },
        ],
    },
    kr: {
        path: '/fear-greed/kr',
        title: '오늘 코스피 증시 심리, 공포 탐욕 지수로 확인',
        description: clampSeoDescription(
            '코스피200·국고채·회사채·동일가중 ETF의 최근 흐름을 묶어 한국 증시 전체의 매수 심리를 0~100 점수와 5단계 라벨로 보여줍니다.'
        ),
        keywords: [
            '코스피 공포 탐욕 지수',
            '한국 증시 심리',
            '국내 증시 투자심리',
            '코스피 심리 지수',
            '공포 탐욕 지수',
            '증시 매수 심리',
        ],
        heading: '한국 공포·탐욕 지수',
        intro: [
            '한국 시장 공포 탐욕 지수는 코스피200(KODEX 200), 코스피 실현변동성, 국고채 30년, 회사채, 국고채 10년, 코스피200 동일가중의 최근 종가 흐름을 묶어 국내 증시 전체의 단기 매수 심리를 0~100 점수로 나타냅니다.',
            '5개 요인을 각각 과거 분포 안에서 백분위로 환산한 뒤 동일 가중으로 평균해 산출하며, 점수가 낮을수록 공포, 높을수록 탐욕 심리가 강하다는 뜻입니다.',
        ],
        faq: [
            {
                question: '한국 공포 탐욕 지수는 무엇을 측정하나요?',
                answer: '코스피200·코스피 실현변동성·국고채 30년·회사채·국고채 10년·코스피200 동일가중, 5개 요인의 최근 종가 흐름을 묶어 국내 증시 전체의 단기 매수 심리를 0~100 점수로 나타냅니다.',
            },
            {
                question: '왜 VKOSPI 대신 실현변동성을 쓰나요?',
                answer: 'VKOSPI(코스피200 변동성지수)는 무료로 받을 수 있는 시세 경로가 없습니다. 대신 코스피 종가에서 20일 실현변동성(연율)을 직접 산출해 변동성 요인에 넣습니다. 요인이 보는 것은 변동성이 자기 과거 평균 대비 높은지 낮은지이므로, 내재변동성 대신 실현변동성을 써도 방향과 해석은 그대로 유지됩니다.',
            },
            {
                question: '미국 공포 탐욕 지수와 점수를 직접 비교해도 되나요?',
                answer: '계산식은 같지만 입력 자산이 다릅니다. 특히 국내에는 유동성 있는 하이일드 채권이 없어 신용 요인을 회사채와 국고채 10년의 수익률 차이로 대신합니다. 두 지수는 각자 자기 시장의 과거 분포 안에서 백분위를 매기므로, 같은 60점이라도 뜻하는 바가 다릅니다 — 각 시장 안에서의 추세로 읽어 주세요.',
            },
            {
                question: '점수는 얼마나 자주 갱신되나요?',
                answer: '코스피 정규장 마감 종가를 기준으로 세션 단위(하루 한 번)로 갱신되며, 페이지 자체는 최대 1시간 캐시됩니다.',
            },
        ],
    },
};
