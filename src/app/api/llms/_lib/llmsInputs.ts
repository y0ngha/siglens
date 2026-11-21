import 'server-only';
import backtestData from '@/entities/backtest-case/data/data.json';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import type { LlmsInputs } from '@/app/api/llms/_lib/model';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_URL } from '@/shared/lib/seo';

// 모듈 로드 시 한 번 검증한다(sitemap `childEntries.ts`와 같다). 형식이 틀리면 빌드가 먼저 실패한다.
const BACKTEST_RUN_ID = validateBacktestRunData(backtestData as unknown).run
    .runId;

/** 본문 빌더의 입력. 게이트는 요청마다 읽는다(서버 env). */
export function llmsInputs(): LlmsInputs {
    return {
        siteUrl: SITE_URL,
        aiSiteUrl: AI_SITE_URL,
        benchmark: getPublishedBenchmarkRelease(),
        backtestRunId: BACKTEST_RUN_ID,
        publicApiEnabled: isPublicApiEnabled(),
    };
}
