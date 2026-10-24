import 'server-only';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    fetchNaverInvestorTrend,
    type NaverInvestorTrendRow,
} from '@/shared/api/naver/naverInvestorTrend';
import { krSymbolToStockCode } from '@/entities/investor-flows/lib/dartSymbol';
import { logToolDegrade } from '@/app/api/ai/chat/tools/logToolDegrade';

/** 최신 거래일이 장 마감 뒤에야 올라오고 값이 하루 단위라 짧게만 캐시한다(30분). */
const KR_TREND_TTL_SECONDS = 30 * SECONDS_PER_MINUTE;
/** HTTP 200 `[]`(네이버에 이 종목 추세가 없음) — 정상 결과라 길게 캐시한다. */
export const KR_TREND_NO_DATA_TTL_SECONDS = 6 * SECONDS_PER_HOUR;
/** 던진 실패(비공식 엔드포인트 장애·형태 변경)의 음성 캐시 — 매 호출마다 두드리지 않도록 짧게만. */
export const KR_TREND_FAILURE_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;
export const KR_TREND_SHORT_WINDOW = 5;
export const KR_TREND_LONG_WINDOW = 20;
/** 출력에 싣는 행 수 — 도구 출력 예산(`summarizeKrInvestorFlows.ts` 주석) 때문에 합산 창(20)보다 작다. */
export const KR_TREND_ROWS_SHOWN = 10;

interface InvestorNetSum {
    foreignNet: number;
    institutionNet: number;
    individualNet: number | null;
}

/**
 * `get_investor_flows`의 `krInvestorTrend` — 한국 종목 투자자별(외국인·기관·개인) 일별 순매수량(주). 출처는 네이버 증권이다.
 * `asOf`는 실제로 있는 가장 최신 `bizdate`(네이버는 장 마감 뒤에야 당일을 올린다). `sum5d`/`sum20d`는 최신 5/20행 합이고,
 * 20행이 안 되면 `sum20d`는 null이다. 개인 값이 합산 구간 안에 하나라도 없으면 그 합의 `individualNet`은 null이다.
 */
export interface KrInvestorTrendView {
    asOf: string;
    /** 최신 {@link KR_TREND_ROWS_SHOWN}행만 — 합계는 가져온 전체 행으로 계산한다. */
    rows: NaverInvestorTrendRow[];
    /** 유효한 행이 5개 미만이면 null. */
    sum5d: InvestorNetSum | null;
    sum20d: InvestorNetSum | null;
    unit: 'shares';
    source: 'naver';
}

function sumRows(rows: readonly NaverInvestorTrendRow[]): InvestorNetSum {
    const individuals = rows.map(r => r.individualNet);
    return {
        foreignNet: rows.reduce((s, r) => s + r.foreignNet, 0),
        institutionNet: rows.reduce((s, r) => s + r.institutionNet, 0),
        individualNet: individuals.every(v => v !== null)
            ? individuals.reduce((s, v) => s + v, 0)
            : null,
    };
}

/** 순수 — 최신순 행 → 뷰. 행이 없으면 null. */
export function buildKrInvestorTrend(
    allRows: readonly NaverInvestorTrendRow[]
): KrInvestorTrendView | null {
    const rows = allRows.slice(0, KR_TREND_LONG_WINDOW);
    if (rows.length === 0) return null;
    return {
        asOf: rows[0]!.date,
        rows: rows.slice(0, KR_TREND_ROWS_SHOWN),
        sum5d:
            rows.length >= KR_TREND_SHORT_WINDOW
                ? sumRows(rows.slice(0, KR_TREND_SHORT_WINDOW))
                : null,
        sum20d: rows.length >= KR_TREND_LONG_WINDOW ? sumRows(rows) : null,
        unit: 'shares',
        source: 'naver',
    };
}

/** 캐시에 담는 값 — 실패·데이터 없음·정상을 구분해 TTL을 달리한다. */
type TrendCacheEntry =
    | { kind: 'ok'; rows: NaverInvestorTrendRow[] }
    | { kind: 'none' }
    | { kind: 'failed' };

/** kind별 TTL — `Record`라 새 kind가 생기면 여기서 컴파일 오류가 난다(조용히 정상 TTL로 떨어지지 않는다). */
const TTL_BY_KIND: Readonly<Record<TrendCacheEntry['kind'], number>> = {
    ok: KR_TREND_TTL_SECONDS,
    none: KR_TREND_NO_DATA_TTL_SECONDS,
    failed: KR_TREND_FAILURE_TTL_SECONDS,
};

function ttlFor(entry: TrendCacheEntry): number {
    return TTL_BY_KIND[entry.kind];
}

async function fetchEntry(code: string): Promise<TrendCacheEntry> {
    try {
        const rows = await fetchNaverInvestorTrend(code);
        return rows.length === 0 ? { kind: 'none' } : { kind: 'ok', rows };
    } catch (error) {
        // 실패는 로그로 "데이터 없음"과 구분된다(없음은 정상 결과라 로그하지 않는다). 짧게 음성 캐시해 재호출을 막는다.
        logToolDegrade('get_investor_flows', 'naver investor trend', error);
        return { kind: 'failed' };
    }
}

/**
 * 도구 전체를 실패시키지 않는다 — 실패(네트워크·형태 불일치)와 HTTP 200 `[]`(데이터 없음) 모두 `null`이고, 모델은 이를
 * "확인 못 함"으로 말한다(`notProvided`). 다만 캐시는 다르다: 정상 30분, 데이터 없음 6시간, 실패 5분.
 */
export async function loadKrInvestorTrend(
    symbol: string
): Promise<KrInvestorTrendView | null> {
    const code = krSymbolToStockCode(symbol);
    if (code === null) return null;
    try {
        const entry = await getOrSetCache<TrendCacheEntry>(
            `naver:investor-trend:v2:${code}`,
            ttlFor,
            () => fetchEntry(code)
        );
        return entry.kind === 'ok' ? buildKrInvestorTrend(entry.rows) : null;
    } catch (error) {
        logToolDegrade(
            'get_investor_flows',
            'naver investor trend cache',
            error
        );
        return null;
    }
}
