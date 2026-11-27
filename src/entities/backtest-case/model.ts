import type {
    BacktestBenchmarks,
    BacktestRunData,
    BacktestTickerBaseline,
    BacktestTrade,
    BacktestTrendRecognition,
} from '@y0ngha/siglens-core';

/**
 * 백테스트 화면에 쓰는 통계.
 *
 * 전략 통계는 `data.json`에 손으로 적은 요약이 아니라 `trades`에서 직접 계산한다 — 요약과
 * 데이터가 어긋날 수 없게 하려는 것이다. 시세가 필요한 기준선(보유, 투자 비중을 맞춘 보유,
 * 임의 날짜 진입, 목표가·손절가 시험)은 생성기가 계산해 넣고(`BacktestRunData.baselines`,
 * `BacktestRunData.benchmarks`) 화면은 그 값을 다시 계산하지 않고 그대로 보여 준다.
 *
 * 퍼센트 값은 소수 둘째 자리로 반올림한다. 4단계 판정(`summary.json`)과 같은 정의·자릿수다.
 */

/**
 * 매매 하나의 청산 경로. 절반 A·B의 청산 사유 조합에서 파생한다.
 * - `tp1_tpFinal`: A 1차 목표가 익절 + B 최종 목표가 익절
 * - `tp1_trailing`: A 1차 목표가 익절 + B 갱신된(올라간) 손절가
 * - `tp1_breakeven`: A 1차 목표가 익절 + B 본전 청산
 * - `sl1_tpFinal`: A 손절 + B 최종 목표가 익절
 * - `sl1_sl2`: A 손절 + B 2차 손절
 * - `selloff_recovered`: 급락 매수 규칙 — MA5 회복 또는 10거래일 청산
 * - `selloff_stopped`: 급락 매수 규칙 — 재난 손절
 * - `other`: 그 밖의 조합(최대 보유 기간 만료, 기간 말 보유 등)
 */
export type ExitPathKey =
    | 'tp1_tpFinal'
    | 'tp1_trailing'
    | 'tp1_breakeven'
    | 'sl1_tpFinal'
    | 'sl1_sl2'
    | 'selloff_recovered'
    | 'selloff_stopped'
    | 'other';

export interface ExitPathStat {
    path: ExitPathKey;
    trades: number;
    meanReturnPct: number;
}

export interface TickerStats {
    ticker: string;
    trades: number;
    winRate: number;
    /** 이 종목만 굴린 계좌의 청산 기준 누적 수익률. */
    strategyPct: number;
    strategyMaxDrawdownPct: number;
    /** 보유일 합 ÷ 시뮬레이션 거래일. */
    exposurePct: number;
    /** 같은 기간 이 종목을 처음부터 끝까지 들고 있었을 때의 수익률. */
    buyHoldPct: number;
    /** 처음부터 끝까지 들고 있었을 때의 최대 낙폭(일별 종가). */
    buyHoldMaxDrawdownPct: number;
    /** 이 종목에서 AI 전략이 시장에 있던 비중만큼만 들고 나머지는 현금으로 둔 경우의 수익률. */
    exposureMatchedHoldPct: number;
    /** AI 전략의 이 종목 계좌를 매일 종가로 평가한 최대 낙폭. */
    markToMarketMaxDrawdownPct: number;
}

/**
 * 검증을 통과한 실행 데이터. 기준선 필드는 코어 타입에서는 옛 데이터를 위해 선택이지만 이
 * 화면은 모두 요구한다(`validateBacktestRunData`) — 값이 빠진 데이터는 빌드에서 거절된다.
 */
export interface VerifiedBacktestRunData extends BacktestRunData {
    readonly baselines: readonly (BacktestTickerBaseline &
        Required<
            Pick<
                BacktestTickerBaseline,
                'exposureMatchedHoldPct' | 'markToMarketMaxDrawdownPct'
            >
        >)[];
    readonly benchmarks: BacktestBenchmarks;
}

/**
 * 화면 한 줄에 필요한 매매 값. UI 파일이 entity `lib/`를 직접 부르지 않도록(widgets/CLAUDE.md)
 * 키와 청산 경로를 app 레이어에서 미리 계산해 넘긴다.
 */
export interface BacktestTradeRowModel {
    key: string;
    ticker: string;
    entryDate: string;
    exitPath: ExitPathKey;
    trade: BacktestTrade;
}

export interface BacktestStats {
    totalTrades: number;
    /** 승률의 분모 — 기간 말까지 보유 중인 매매는 뺀다. */
    closedTrades: number;
    winningTrades: number;
    winRate: number;
    meanReturnPct: number;
    medianReturnPct: number;
    meanHoldingDays: number;
    /** 종목 수만큼 같은 금액으로 나눠 넣은 포트폴리오(리밸런싱 없음). */
    portfolioReturnPct: number;
    portfolioMaxDrawdownPct: number;
    perTicker: TickerStats[];
    /** 생성기가 계산해 넣은 기준선 묶음. 화면은 재계산 없이 그대로 보여 준다. */
    benchmarks: BacktestBenchmarks;
    exitPaths: ExitPathStat[];
    /** 생성기가 일봉으로 계산해 넣은 값을 그대로 넘긴다(거래 목록만으로는 계산할 수 없다). */
    trendRecognition: BacktestTrendRecognition;
    /** 시뮬레이션 구간(`run.periodStart`/`run.periodEnd`, ISO `YYYY-MM-DD`). */
    periodStart: string;
    periodEnd: string;
}
