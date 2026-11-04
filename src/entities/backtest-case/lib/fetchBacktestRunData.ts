import type { BacktestRunData } from '@y0ngha/siglens-core';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';

/** 공개 정적 데이터 경로. `copy:backtesting`이 빌드 전에 `public/`으로 복사한다. */
export const BACKTEST_DATA_PUBLIC_PATH = '/backtesting/data.json';

/**
 * 공개 정적 파일에서 실행 데이터를 받아 경계에서 검증한다.
 *
 * 서버 HTML(번들된 데이터)과 이 파일은 별개의 사본이다. 실행 id를 쿼리로 붙여 데이터를 바꾼 뒤
 * CDN에 남은 옛 사본을 받지 않게 하고, 받은 실행 id가 페이지의 것과 다르면 던진다 — 최근 월과
 * 펼친 옛 월이 서로 다른 실행의 매매를 보여 주는 것보다 "불러오지 못했어요"가 낫다.
 */
export async function fetchBacktestRunData(
    runId: string
): Promise<BacktestRunData> {
    const response = await fetch(
        `${BACKTEST_DATA_PUBLIC_PATH}?run=${encodeURIComponent(runId)}`
    );
    if (!response.ok) {
        throw new Error(`backtest data: HTTP ${response.status}`);
    }
    const data = validateBacktestRunData(await response.json());
    if (data.run.runId !== runId) {
        throw new Error(
            `backtest data: run ${data.run.runId} does not match ${runId}`
        );
    }
    return data;
}
