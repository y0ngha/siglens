/**
 * 한국 DART 축의 채점 창과 "창 안 보고 없음" 판정.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
    KrInsiderMetrics,
    KrMajorHolderMetrics,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { formatInteger } from '../flowFormat';

/** 한국 축이 "창 안 보고 없음"으로 비었을 때 보여 줄 창 길이와 최신 접수일. */
export interface NoReportsInWindow {
    readonly days: string;
    readonly latestReceiptDate: string;
}

/** DART 원천이 있는 한국 축의 `krMetrics`(창 안 보고 수·최신 접수일)와 채점 창 길이. */
interface KrAxisWindow {
    readonly metrics:
        | Pick<
              KrMajorHolderMetrics | KrInsiderMetrics,
              'reports' | 'latestReceiptDate'
          >
        | undefined;
    readonly days: number;
}

/** 한국 점수표에서 DART 원천이 있는 두 축만 창을 돌려준다. 그 밖의 축은 `null`이다. */
const KR_AXIS_WINDOW: Record<
    InvestorFlowsAxisId,
    ((scorecard: InvestorFlowsScorecard) => KrAxisWindow) | null
> = {
    largeHolders: scorecard => ({
        metrics: scorecard.largeHolders.krMetrics,
        days: scorecard.freshness.largeHolderWindow.days,
    }),
    insider: scorecard => ({
        metrics: scorecard.insider.krMetrics,
        days: scorecard.freshness.insiderWindow.days,
    }),
    institutional: null,
    short: null,
    dilution: null,
};

/**
 * 한국 대량보유·임원 축이 `insufficient`인데 core가 `krMetrics`를 `reports === 0`과 `latestReceiptDate`로 준 경우 — 쓸 수
 * 있는 보고가 채점 창(최근 N일) 밖에만 있다. "데이터 부족"이 아니라 "최근 N일 공시 없음(최신 접수일 …)"으로 말해야 해서
 * 창 길이와 접수일을 돌려준다. 그 밖의 경우(미국 점수표, 채점된 축, 보고가 아예 없는 축)는 `null`이다.
 */
export function krNoReportsInWindow(
    scorecard: InvestorFlowsScorecard,
    axis: InvestorFlowsAxisId,
    locale: Locale
): NoReportsInWindow | null {
    if (scorecard.market !== 'kr') return null;
    if (scorecard[axis].sufficiency !== 'insufficient') return null;
    const krWindow = KR_AXIS_WINDOW[axis]?.(scorecard) ?? null;
    const latestReceiptDate = krWindow?.metrics?.latestReceiptDate ?? null;
    if (
        krWindow === null ||
        krWindow.metrics?.reports !== 0 ||
        latestReceiptDate === null
    ) {
        return null;
    }
    return { days: formatInteger(krWindow.days, locale), latestReceiptDate };
}
