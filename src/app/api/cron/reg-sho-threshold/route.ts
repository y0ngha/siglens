import { handleLeasedCron } from '../leasedCron';
import { createRegShoDeps } from './createDeps';
import { runRegShoIngest } from '@/entities/investor-flows/server/ingestRegSho';

/**
 * 마감 4분 + 진행 중 목록 하나 최악 ≈ 62초(요청 30초 × 2회 + 백오프 ≤ 2초) + DB 여유 30초 ≈ 5.5분 < 락 TTL 7분(SERVER.md#CC-7,
 * `route.test.ts`가 실제 상수로 검증). 목록은 수 KB짜리 파일이라 평소에는 백필(5개 시장 × ~42거래일)도 1~2분이면 끝난다.
 */
const REG_SHO_DEADLINE_MS = 4 * 60 * 1000;
const REG_SHO_LEASE_TTL_SECONDS = 7 * 60;

/**
 * Reg SHO 과열 목록 수집 cron(`PATCH /api/cron/reg-sho-threshold`) — 평일 05:00 UTC. 거래소 서버(Nasdaq·NYSE·Cboe)라 SEC 요청
 * 예산·공유 락과 무관해 이름별 락을 쓴다.
 *
 * ⚠️ `REG_SHO_THRESHOLD_DATA_ENABLED=false`면 요청 0건으로 끝난다(거래소 데이터 비상업 라이선스, 이슈 #1042 —
 * `shared/api/exchange/regShoThresholdDataEnabled.ts`).
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'reg-sho-threshold',
        leaseTtlSeconds: REG_SHO_LEASE_TTL_SECONDS,
        deadlineMs: REG_SHO_DEADLINE_MS,
        run: ({ isDeadlineReached }) =>
            runRegShoIngest(createRegShoDeps(isDeadlineReached)),
    });
}
