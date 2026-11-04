import backtestData from '@/entities/backtest-case/data/data.json';
import { deriveBacktestStats } from '@/entities/backtest-case/lib/deriveBacktestStats';
import { toTradeRows } from '@/entities/backtest-case/lib/tradeRows';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';

/** 정적 산출물을 모듈 로드 시 한 번 검증한다 — 형식이 틀리면 빌드가 실패한다. */
export const BACKTEST_RUN = validateBacktestRunData(backtestData as unknown);

export const BACKTEST_STATS = deriveBacktestStats(BACKTEST_RUN);

export const BACKTEST_TICKERS: string[] = [...BACKTEST_RUN.run.tickers];

/** 매매 목록 행 모델(키·청산 경로 포함) — UI가 entity `lib/`를 직접 부르지 않게 여기서 만든다. */
export const BACKTEST_TRADE_ROWS = toTradeRows(BACKTEST_RUN.trades);
