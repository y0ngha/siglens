import backtestData from '@/entities/backtest-case/data/data.json';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import type { LlmsInputs } from '@/app/api/llms/_lib/model';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';

export const TEST_RUN_ID = validateBacktestRunData(backtestData as unknown).run
    .runId;

/** 운영 값과 같은 입력(실제 벤치마크 릴리스, 실제 실행 id). 게이트만 덮어쓴다. */
export function testInputs(overrides: Partial<LlmsInputs> = {}): LlmsInputs {
    return {
        siteUrl: SITE_URL,
        aiSiteUrl: AI_SITE_URL,
        benchmark: getPublishedBenchmarkRelease(),
        backtestRunId: TEST_RUN_ID,
        publicApiEnabled: false,
        ...overrides,
    };
}
