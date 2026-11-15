import type { SignalType, StockSignalResult } from '@y0ngha/siglens-core';

/** 홈 "오늘의 시장"의 신호 종목 한 줄. */
export interface TodaySignalRow {
    readonly symbol: string;
    /** 한글 종목명. 없으면 `null`(표시는 티커로). */
    readonly koreanName: string | null;
    readonly changePercent: number;
    /** 이 종목에서 고른 대표 신호 하나. */
    readonly signalType: SignalType;
    /**
     * 대표 신호가 아직 확정되지 않은 예상(`expected`) 단계인가. 화면은 이때 "예상" 표시를 붙인다 —
     * 붙이지 않으면 교차 직전인 골든크로스가 오늘 일어난 교차처럼 읽힌다(가이드 라이브 종목과 같은 규칙).
     */
    readonly expected: boolean;
}

/**
 * 대표 신호 우선순위 — 앞일수록 먼저 보인다.
 *
 * 기준은 **사람들이 찾는 신호**다. 골든·데드크로스, 52주 신고·신저, RSI 과매도·과매수는
 * 검색 수요가 있는 이름이고(네이버 자동완성 실측: "골든크로스 종목", "52주 신고가 종목"),
 * CCI·CMF 교차처럼 하루에 수십 종목씩 잡히는 신호는 뒤로 민다 — 앞에 두면 목록이 늘
 * 같은 종류로 채워진다. 목록에 없는 신호는 확정(`confirmed`)만, 맨 뒤 순서로 받는다.
 */
const SIGNAL_PRIORITY: readonly SignalType[] = [
    'golden_cross',
    'new_52w_high',
    'death_cross',
    'new_52w_low',
    'rsi_oversold',
    'rsi_overbought',
    'macd_bullish_cross',
    'macd_bearish_cross',
    'bollinger_upper_breakout',
    'bollinger_lower_bounce',
    'ichimoku_cloud_breakout',
    'ichimoku_cloud_breakdown',
    'supertrend_bullish_flip',
    'supertrend_bearish_flip',
    'gap_up',
    'gap_down',
    'rsi_bullish_divergence',
    'rsi_bearish_divergence',
];

const RANK: ReadonlyMap<SignalType, number> = new Map(
    SIGNAL_PRIORITY.map((type, index) => [type, index])
);
const UNRANKED = SIGNAL_PRIORITY.length;

interface Candidate {
    readonly row: TodaySignalRow;
    readonly rank: number;
}

/** 확정이 예상보다 앞이다. 우선순위보다 먼저 본다 — 확정된 52주 신고가가 예상 골든크로스보다 앞선다. */
function phaseOrder(expected: boolean): number {
    return expected ? 1 : 0;
}

function pickRepresentative(stock: StockSignalResult): Candidate | null {
    const ranked = stock.signals
        // 우선순위 목록 밖의 신호는 확정된 것만 — 예상(`expected`) 신호까지 받으면 거의 모든
        // 종목이 무언가 하나는 갖게 되어 "신호가 잡힌 종목"이라는 말이 흐려진다.
        .filter(signal => RANK.has(signal.type) || signal.phase === 'confirmed')
        .map(signal => ({
            type: signal.type,
            expected: signal.phase === 'expected',
            rank: RANK.get(signal.type) ?? UNRANKED,
        }))
        .toSorted(
            (a, b) =>
                phaseOrder(a.expected) - phaseOrder(b.expected) ||
                a.rank - b.rank
        );
    const best = ranked[0];
    if (best === undefined) return null;
    return {
        rank: best.rank,
        row: {
            symbol: stock.symbol,
            koreanName: stock.koreanName === '' ? null : stock.koreanName,
            changePercent: stock.changePercent,
            signalType: best.type,
            expected: best.expected,
        },
    };
}

/**
 * 스캐너 결과에서 홈에 보일 신호 종목을 고른다. 종목마다 대표 신호 하나를 고르고, 확정 여부 →
 * 신호 우선순위 → 등락률 크기 순으로 `limit`개를 자른다. 같은 종목은 한 번만 나온다(스캐너가
 * 섹터마다 같은 종목을 실을 수 있다).
 *
 * 가이드 라이브 종목(`views/guide/lib/liveSymbols`)과 선택 기준이 다르다 — 그쪽은 "이 항목이 다루는
 * 신호 종류만" 고르고, 여기는 "모든 신호 중 대표 하나"를 고른다. 확정 우선·예상 표시 규칙은 같다.
 */
export function selectTodaySignals(
    stocks: readonly StockSignalResult[],
    limit: number
): TodaySignalRow[] {
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const stock of stocks) {
        if (seen.has(stock.symbol)) continue;
        seen.add(stock.symbol);
        const candidate = pickRepresentative(stock);
        if (candidate !== null) candidates.push(candidate);
    }
    return candidates
        .toSorted(
            (a, b) =>
                phaseOrder(a.row.expected) - phaseOrder(b.row.expected) ||
                a.rank - b.rank ||
                Math.abs(b.row.changePercent) - Math.abs(a.row.changePercent) ||
                a.row.symbol.localeCompare(b.row.symbol)
        )
        .slice(0, limit)
        .map(candidate => candidate.row);
}
