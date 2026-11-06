import type {
    MarketFearGreedComparisonKey,
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { MS_PER_DAY } from '@/shared/config/time';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { FearGreedMetaFacts } from '@/views/symbol/fearGreed/utils/fearGreedFacts';
import { composeFearGreedDescription } from '@/views/symbol/fearGreed/utils/fearGreedMetaDescription';

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
        score: snapshot.score,
        label: snapshot.label,
        past: view.comparisons.flatMap(point => {
            if (point.key === 'now') return [];
            const period = PERIOD_BY_KEY[point.key];
            return daysBetween(point.date, snapshot.asOf) >=
                MIN_DAYS_BEFORE[period]
                ? [{ period, score: point.score }]
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
