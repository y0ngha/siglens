import { runOutcomeLabeller } from '@/entities/analysis-outcome/server/runOutcomeLabeller';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { handleLeasedCron } from '../leasedCron';
import { createAnalysisOutcomesDeps } from './createDeps';

/**
 * 마감 8분. 락 TTL 12분 = 마감 + 청크 하나(그룹당 로드 타임아웃 20초 + 행 쓰기) + DB만 쓰는 capture·relabel·prune 여유
 * (`__tests__/route.test.ts`가 상수에서 이 부등식을 유도해 고정한다).
 */
const ANALYSIS_OUTCOMES_DEADLINE_MS = 8 * MS_PER_MINUTE;
const ANALYSIS_OUTCOMES_LEASE_TTL_SECONDS = 12 * 60;

/**
 * 분석 사후 결과 라벨러(`PATCH /api/cron/analysis-outcomes`) — 06:10~09:40 UTC 30분마다 8번.
 * 분석이 말한 것(`subject`)을 캡처하고, 20봉이 쌓인 분석을 봉만으로 라벨하고(LLM 호출 없음), 정의가 바뀐
 * 라벨을 저장된 창으로 다시 계산하고, 730일 지난 행을 지운다. 본문과 외부 요청 최악치는
 * `entities/analysis-outcome/server/runOutcomeLabeller.ts` 머리말이 정본이다.
 *
 * 응답은 202, 실행 요약은 `[analysis-outcomes] run done:` 한 줄이다(`handleLeasedCron`). `[analysis-outcomes] run
 * failed`와 `[analysis-outcomes] step failed`는 알람 필터 문구다(`infra/aws/22-analysis-outcomes-cron.sh`).
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'analysis-outcomes',
        leaseTtlSeconds: ANALYSIS_OUTCOMES_LEASE_TTL_SECONDS,
        deadlineMs: ANALYSIS_OUTCOMES_DEADLINE_MS,
        run: async ({ isDeadlineReached }) =>
            runOutcomeLabeller(createAnalysisOutcomesDeps(isDeadlineReached)),
    });
}
