import { resolveNextEarnings } from '@/entities/analyst-views/lib/resolveNextEarnings';
import type {
    AnalystEarningsHint,
    EarningsSession,
} from '@/entities/analyst-views/model';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

/** 실적 카드 한 장. 다음 실적(`future`)만 Yahoo 힌트와 대조한 확정 여부·세션을 싣는다. */
export interface EarningsCardItem extends EarningsReportComparisonItem {
    /** 확정 여부 3상태(`true`·`false`·모름). 지난 실적과 힌트가 없는 다음 실적은 `null`. */
    confirmed: boolean | null;
    /** 확정된 다음 실적의 발표 시간대. 그 밖은 `null`. */
    session: EarningsSession | null;
}

/**
 * 비교 항목의 다음 실적(`future`)을 Yahoo 힌트와 대조한다(`resolveNextEarnings` — 에이전트·펀더멘털 탭·AI 분석과
 * 같은 판정). 회사가 다른 날짜를 확정했으면 그 날짜로 바꾸고, 지난 실적은 그대로 둔다.
 *
 * @param today 그 종목 시장의 오늘(`earningsMarketToday`).
 */
export function withNextEarnings(
    items: readonly EarningsReportComparisonItem[],
    hint: AnalystEarningsHint | null,
    today: string
): EarningsCardItem[] {
    return items.map(item => {
        if (item.period !== 'future')
            return { ...item, confirmed: null, session: null };
        const resolved = resolveNextEarnings({
            scheduledDate: item.earningsDate,
            scheduledConfirmed: null,
            hint,
            today,
        });
        return {
            ...item,
            earningsDate: resolved.date ?? item.earningsDate,
            confirmed: resolved.confirmed,
            session: resolved.session,
        };
    });
}
