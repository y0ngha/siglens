import type { MeasuredSignalBaseRate } from '@y0ngha/siglens-core';

/** 표가 싣는 기간(봉 수 = 거래일 수) — 항상 이 순서, 이 네 개 전부다. 비율 크기로 정렬하지 않는다. */
const RECORD_HORIZON_DAYS = [1, 5, 10, 20] as const;

/** 비율을 싣는 행. 비율은 화면용 문자열(`53.2%`)로 이미 맞춰 둔다. */
interface SignalRecordRatesRow {
    readonly kind: 'rates';
    readonly days: number;
    readonly n: number;
    readonly event: string;
    readonly placebo: string;
    readonly verdict: 'beats_placebo' | 'no_edge';
}

/** 표본이 적어 비율을 숨기는 행. 숫자는 하나도 싣지 않는다. */
interface SignalRecordInsufficientRow {
    readonly kind: 'insufficient';
    readonly days: number;
}

type SignalRecordRow = SignalRecordRatesRow | SignalRecordInsufficientRow;

interface SignalRecordView {
    readonly direction: 'bullish' | 'bearish';
    /** 합산 범위 — 시장별 종목 수. */
    readonly usSymbols: number;
    readonly krSymbols: number;
    /** 첫·마지막 신호 확정일(`YYYY-MM-DD`). */
    readonly from: string;
    readonly to: string;
    /** 항상 네 줄(1·5·10·20). */
    readonly rows: readonly SignalRecordRow[];
}

const PERCENT = 100;

/** 0~1 비율을 소수 한 자리 퍼센트 문자열로("0.48381" → "48.4%"). */
function formatShareAsPercent(share: number): string {
    return `${(share * PERCENT).toFixed(1)}%`;
}

function isCompleteHorizons(record: MeasuredSignalBaseRate): boolean {
    return (
        record.horizons.length === RECORD_HORIZON_DAYS.length &&
        record.horizons.every(
            (horizon, i) => horizon.h === RECORD_HORIZON_DAYS[i]
        )
    );
}

/**
 * core의 측정 기록을 화면용 모양으로 바꾼다. 네 기간이 모두 있고 합산 범위(미국·한국)가 다 있을 때만
 * 값을 낸다 — 아니면 `null`이라 블록을 통째로 그리지 않는다(일부 기간만 보여 주면 한 기간만 따로 읽힌다).
 *
 * 비율은 판정이 `insufficient_sample`일 때뿐 아니라 어느 한쪽 비율이 `null`일 때도 숨긴다: 판정 문장이
 * 비율을 전제하므로, 비율이 없는 칸에 "임의 날짜보다 높았어요"를 적을 수 없다.
 */
export function buildSignalRecordView(
    record: MeasuredSignalBaseRate | null
): SignalRecordView | null {
    if (record === null || !isCompleteHorizons(record)) return null;
    const us = record.scope.markets.find(entry => entry.market === 'us');
    const kr = record.scope.markets.find(entry => entry.market === 'kr');
    if (us === undefined || kr === undefined) return null;

    const rows = record.horizons.map((horizon): SignalRecordRow => {
        const { eventShare, placeboShare, verdict } = horizon;
        if (
            verdict === 'insufficient_sample' ||
            eventShare === null ||
            placeboShare === null
        ) {
            return { kind: 'insufficient', days: horizon.h };
        }
        return {
            kind: 'rates',
            days: horizon.h,
            n: horizon.n,
            event: formatShareAsPercent(eventShare),
            placebo: formatShareAsPercent(placeboShare),
            verdict,
        };
    });

    return {
        direction: record.direction,
        usSymbols: us.symbols,
        krSymbols: kr.symbols,
        from: record.scope.from,
        to: record.scope.to,
        rows,
    };
}
