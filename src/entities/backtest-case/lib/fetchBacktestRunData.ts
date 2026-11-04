import type { BacktestRunData } from '@y0ngha/siglens-core';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';

/** 공개 정적 데이터 경로. `copy:backtesting`이 빌드 전에 `public/`으로 복사한다. */
export const BACKTEST_DATA_PUBLIC_PATH = '/backtesting/data.json';

/** 공개 정적 파일에서 실행 데이터를 받아 경계에서 검증한다. */
export async function fetchBacktestRunData(): Promise<BacktestRunData> {
    const response = await fetch(BACKTEST_DATA_PUBLIC_PATH);
    if (!response.ok) {
        throw new Error(`backtest data: HTTP ${response.status}`);
    }
    return validateBacktestRunData(await response.json());
}
