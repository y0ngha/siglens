import type {
    MarketFearGreedComparisonKey,
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { MS_PER_DAY } from '@/shared/config/time';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { SeoTranslator } from '@/shared/lib/seo';
import { clampSeoTitle } from '@/shared/lib/seoClamp';
import type { FearGreedMetaFacts } from '@/views/symbol/fearGreed/utils/fearGreedFacts';
import {
    composeFearGreedDescription,
    formatFactsDate,
} from '@/views/symbol/fearGreed/utils/fearGreedMetaDescription';

/** 비교 시점 키 → 메타 사실의 기간. `now`는 현재 점수 자체라 과거 목록에 넣지 않는다. */
const PERIOD_BY_KEY: Record<
    Exclude<MarketFearGreedComparisonKey, 'now'>,
    FearGreedMetaFacts['past'][number]['period']
> = {
    '1w': 'week',
    '1m': 'month',
    '1y': 'year',
};

/**
 * 기간 이름을 붙여도 되는 최소 달력일. 비교점은 이력이 짧으면 점수가 있는 가장 이른 세션으로
 * 당겨지는데(`resolveSessionComparisons`의 `clamped`), 시장 뷰는 그 표시를 싣지 않는다
 * (`buildMarketFearGreedComparisons`). 그래서 날짜 간격으로 되짚는다 — 5세션·21세션·252세션은
 * 휴장일이 있어도 각각 7일·29일·364일 안팎이고(크립토 달력일 오프셋은 7·30·365일), 당겨진 점은
 * 이 하한에 못 미친다.
 *
 * 하한은 그 오프셋에서 휴장 여유를 뺀 값이라 오프셋에 묶여 있다. `COMPARISON_OFFSETS`나
 * `CALENDAR_COMPARISON_OFFSETS`(`buildMarketFearGreedComparisons.ts`)를 바꾸면 여기도 다시
 * 맞추고, `__tests__/marketFearGreedAnswer.test.ts`의 당겨진 점 케이스로 확인한다.
 */
const MIN_DAYS_BEFORE: Record<
    FearGreedMetaFacts['past'][number]['period'],
    number
> = {
    week: 5,
    month: 25,
    year: 300,
};

function daysBetween(earlier: string, later: string): number {
    return (Date.parse(later) - Date.parse(earlier)) / MS_PER_DAY;
}

/**
 * 시장 판독값을 종목 공포탐욕 탭의 메타 사실 모양으로 옮긴다. 판독값이 없으면 `null`.
 *
 * 시장 뷰는 walk-forward 이력을 싣지 않으므로(`MarketFearGreedView` JSDoc) 1년 범위는
 * 만들 수 없어 `range: null`이다 — 문장은 현재 점수와 1주·1개월·1년 전 점수까지만 말한다.
 * 종목 탭과 같은 규칙으로 **실제로 그만큼 지난 비교점만** 싣는다(`MIN_DAYS_BEFORE`) — 이력이
 * 짧은 시장에서 몇 주 전 세션을 "1년 전"이라고 부르지 않는다.
 */
export function marketFearGreedMetaFacts(
    view: MarketFearGreedView<MarketFearGreedViewSnapshot>
): FearGreedMetaFacts | null {
    const { snapshot } = view;
    if (snapshot === null) return null;
    return {
        date: snapshot.asOf,
        // 판독값 점수는 반올림 전 실수(예: 24.48367…)다 — 화면 게이지·비교 타일과 같이 정수로 말한다.
        score: Math.round(snapshot.score),
        label: snapshot.label,
        past: view.comparisons.flatMap(point => {
            if (point.key === 'now') return [];
            const period = PERIOD_BY_KEY[point.key];
            return daysBetween(point.date, snapshot.asOf) >=
                MIN_DAYS_BEFORE[period]
                ? [{ period, score: Math.round(point.score) }]
                : [];
        }),
        range: null,
    };
}

/**
 * `미국 시장 공포 탐욕 지수는 11월 5일 종가 기준 24점(극심한 공포)입니다. 1주 전 36점, …이었습니다.`
 *
 * 허브의 첫 문단과 meta·og 설명이 함께 쓰는 **답 문장**. AI 검색은 페이지에서 질문("오늘 공포
 * 탐욕 지수")에 바로 답하는 한 문장을 인용하므로, 점수·날짜를 게이지 숫자로만 두지 않고 정의
 * 문단보다 먼저 한 문장으로 말한다. 종목 탭과 같은 문장 빌더(`composeFearGreedDescription`)를
 * 써 두 표면의 문형이 갈리지 않는다. 판독값이 없으면 `null`(호출부가 정의 문단·템플릿 설명을 쓴다).
 */
export function composeMarketFearGreedAnswer(
    view: MarketFearGreedView<MarketFearGreedViewSnapshot>,
    subject: string,
    tSeo: SeoTranslator,
    tLabel: EnumLabelTranslator
): string | null {
    const facts = marketFearGreedMetaFacts(view);
    return facts === null
        ? null
        : composeFearGreedDescription(facts, subject, tSeo, tLabel);
}

/**
 * 점수형 `<title>` — `코스피 공포탐욕지수 24점(극심한 공포) 11월 6일 기준`. 판독값이 없으면 `null`
 * (호출부가 템플릿 제목을 쓴다).
 *
 * "오늘 공포탐욕지수"류 질의에 답하는 데이터 페이지는 제목에 그날 점수·단계·기준일을 싣는 것이
 * 일반적이고, AI 검색은 제목으로 질의와 페이지를 맞춘다. 날짜는 렌더 시각이 아니라 **판독값의
 * 기준일**(`snapshot.asOf`)이다 —
 * ISR·CDN이 한두 주기 늦게 내보내도 제목과 본문·description·Dataset이 같은 판독값을 말한다.
 * 브랜드 접미사 없이(absolute) 쓰므로 폭 상한을 이 문자열 하나로 맞춘다.
 */
export function composeMarketFearGreedTitle(
    view: MarketFearGreedView<MarketFearGreedViewSnapshot>,
    subject: string,
    tSeo: SeoTranslator,
    tLabel: EnumLabelTranslator
): string | null {
    const { snapshot } = view;
    if (snapshot === null) return null;
    return clampSeoTitle(
        tSeo('fearGreedPage.answerTitle', {
            subject,
            score: Math.round(snapshot.score),
            label: sentimentLabelText(snapshot.label, tLabel),
            date: formatFactsDate(snapshot.asOf, tSeo),
        })
    );
}

/** 요인 하나의 이름 키와 반올림한 백분위. */
export interface FactorExtreme {
    readonly key: string;
    readonly percentile: number;
}

/** 백분위 중앙. 이 아래가 공포 쪽, 위가 탐욕 쪽이다. */
const PERCENTILE_MIDPOINT = 50;

/**
 * 지금 가장 공포 쪽(백분위 최저)과 가장 탐욕 쪽(백분위 최고)에 있는 요인. 반올림한 최저가 50 미만이고
 * 최고가 50 초과일 때만 낸다 — 모든 요인이 한쪽에 몰려 있으면 "백분위 70이 공포 쪽"처럼 사실과
 * 어긋난 문장이 되고, 반올림 뒤 같은 값이면 말할 차이가 없다. 그 밖에는 `null`.
 *
 * 인용되는 경쟁 페이지는 점수만이 아니라 "왜 이 점수인가"를 데이터로 말한다. 우리는 요인별
 * 백분위를 이미 계산하므로, 그중 양 끝을 한 문장으로 올려 같은 질문에 답한다(LLM 없이 결정적).
 */
export function pickFactorExtremes(
    factors: MarketFearGreedViewSnapshot['factors']
): { fear: FactorExtreme; greed: FactorExtreme } | null {
    if (factors.length < 2) return null;
    const sorted = factors.toSorted((a, b) => a.percentile - b.percentile);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (low === undefined || high === undefined) return null;
    const fear = Math.round(low.percentile);
    const greed = Math.round(high.percentile);
    if (fear >= PERCENTILE_MIDPOINT || greed <= PERCENTILE_MIDPOINT)
        return null;
    return {
        fear: { key: low.key, percentile: fear },
        greed: { key: high.key, percentile: greed },
    };
}

/**
 * 한 판독값에서 점수형 제목과 답 문장을 함께 만든다(라벨 변환을 한 번만). 판독값이 없으면 `null`.
 * 메타데이터와 본문이 같은 함수를 써서 두 표면이 같은 문장·같은 기준일을 말한다.
 */
export function composeMarketFearGreedReading(
    view: MarketFearGreedView<MarketFearGreedViewSnapshot>,
    subjects: { readonly titleSubject: string; readonly answerSubject: string },
    tSeo: SeoTranslator,
    tLabel: EnumLabelTranslator
): { title: string; answer: string } | null {
    const title = composeMarketFearGreedTitle(
        view,
        subjects.titleSubject,
        tSeo,
        tLabel
    );
    const answer = composeMarketFearGreedAnswer(
        view,
        subjects.answerSubject,
        tSeo,
        tLabel
    );
    return title === null || answer === null ? null : { title, answer };
}
