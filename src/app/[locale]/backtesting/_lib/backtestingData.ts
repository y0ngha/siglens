import backtestData from '@/entities/backtest-case/data/data.json';
import { deriveBacktestStats } from '@/entities/backtest-case/lib/deriveBacktestStats';
import { validateBacktestData } from '@/entities/backtest-case/lib/validate';

/**
 * 백테스트 케이스 데이터. JSON import는 느슨한 타입이라 `validateBacktestData`가 로드 시점에
 * shape를 보장한다. `data.json`은 (로컬·gitignore) 생성 스크립트로만 교체되고 요청 시점에는
 * 바뀌지 않으므로 아래 파생값도 모듈 로드 시 한 번만 계산한다.
 */
export const BACKTEST_DATA = validateBacktestData(backtestData as unknown);

/** 화면 히어로와 Dataset JSON-LD(`temporalCoverage`·`dateModified`)가 함께 읽는 통계. */
export const BACKTEST_STATS = deriveBacktestStats(BACKTEST_DATA.cases);

/** 탭 필터가 쓰는 중복 없는 티커 목록(케이스 등장 순서). */
export const BACKTEST_TICKERS = [
    ...new Set(BACKTEST_DATA.cases.map(c => c.ticker)),
];
