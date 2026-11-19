import 'server-only';
import type { ChatDividendsBlock } from '@/entities/chat-conversation/types';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveAssetInfoOrNull } from '../resolveAssetInfo';
import {
    getDescriptor,
    isKrEquitySymbol,
} from '@/shared/config/marketProfile/registry';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { fetchDividendSource, type DividendSource } from '../dividends';
import { roundTo } from './round';
import { noData, type VisualBuildEnv, type VisualOutcome } from './types';

/** 미국 종목이 그리는 연수 상한(한국은 Yahoo 이력이 약 3년이라 있는 만큼). */
export const DIVIDEND_YEARS_MAX = 10;
const AMOUNT_DIGITS = 4;

interface DividendEvent {
    exDate: string;
    amount: number;
}

/** 공급자 원자료에서 배당락 이벤트만 꺼낸다 — 이력을 못 받았으면 `null`. */
export function dividendEventsOf(
    source: DividendSource
): readonly DividendEvent[] | null {
    return source.kind === 'fmp' ? source.rows : source.data.history;
}

/**
 * 배당락일 기준 연도별 주당 배당 합계. 오늘 이후 배당락일(공시만 된 미래 배당)은 빼고, 첫 배당 해부터 올해까지 배당이 없는
 * 해는 0으로 채운다. 올해는 아직 끝나지 않아 `partial`이다. 최근 `maxYears`개 연도만 남긴다.
 */
export function dividendYearsFrom(
    events: readonly DividendEvent[],
    today: string,
    maxYears: number
): ChatDividendsBlock['years'] {
    const past = events.filter(e => e.exDate <= today && e.amount > 0);
    if (past.length === 0) return [];
    const currentYear = Number(today.slice(0, 4));
    // 연도별로 한 번에 묶어 더한다 — 요소마다 Map을 복사하는 reduce는 O(n²)다.
    const sumByYear = new Map(
        Array.from(
            Map.groupBy(past, e => Number(e.exDate.slice(0, 4))),
            ([year, group]) => [
                year,
                group.reduce((sum, e) => sum + e.amount, 0),
            ]
        )
    );
    const firstYear = Math.min(...sumByYear.keys());
    return Array.from(
        { length: currentYear - firstYear + 1 },
        (_, i) => firstYear + i
    )
        .map(year => ({
            year,
            amount: roundTo(sumByYear.get(year) ?? 0, AMOUNT_DIGITS),
            partial: year === currentYear,
        }))
        .slice(-maxYears);
}

/** 연도별 배당 — 배당 이력이 있는 종목만. */
export async function buildDividendsBlock(
    symbol: string,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    const kr = isKrEquitySymbol(symbol);
    const [source, profile] = await Promise.all([
        fetchDividendSource(symbol, kr),
        // 통화를 정하는 데만 쓴다 — 자산 조회가 실패해도 그림 전체를 버리지 않고 기본 시장으로 내려간다.
        resolveAssetInfoOrNull(symbol, 'show_chart').then(
            marketProfileForAssetInfo
        ),
    ]);
    if (source === null) return noData('dividend_history_unavailable');
    const events = dividendEventsOf(source);
    if (events === null) return noData('dividend_history_unavailable');
    const today = zonedDate(env.now, kr ? 'Asia/Seoul' : 'America/New_York');
    const years = dividendYearsFrom(events, today, DIVIDEND_YEARS_MAX);
    if (years.length === 0) return noData('no_dividends_paid');
    const currency = getDescriptor(profile).priceFormat.currency;
    const block: ChatDividendsBlock = {
        version: 1,
        kind: 'dividends',
        asOf: env.now.toISOString(),
        symbol,
        currency,
        years,
    };
    return {
        block,
        summary: {
            symbol,
            currency,
            note: 'dividend per share summed by ex-dividend year; the current year is partial',
            years,
        },
    };
}
