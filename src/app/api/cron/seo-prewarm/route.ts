import { constants } from 'node:http2';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { acquirePrewarmLock } from './lock';
import { runSeoPrewarmJob } from './runSeoPrewarmJob';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

/**
 * SEO pre-warm cron 엔드포인트(`PATCH /api/cron/seo-prewarm`).
 * EventBridge API Destination(~5s)·게이트웨이 idle timeout(2026-08 cloudflared
 * 전환 이후 Cloudflare Proxy Read Timeout ~125.9s)을 피하려 202를 즉시 반환하고
 * 배치는 after()로 백그라운드 실행. 중첩 실행은 Redis 루트 락이 차단하며,
 * 락 보유 중엔 204(2xx — EventBridge 재시도 폭풍 방지).
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    // `acquirePrewarmLock`은 redis 미구성이면 fail-closed로 null을 돌려주지만, Upstash 장애·타임아웃처럼
    // `redis.set()` 자체가 reject하는 경우는 예외로 전파된다. 그대로 두면 500이 나가고 EventBridge는 5xx를
    // 공격적으로 재시도한다(기본 최대 185회/24h) — 락 보유 중 204를 돌려주는 설계(재시도 폭풍 방지)와 반대다.
    // 어떤 이유로 던지든 204로 흡수한다. `[seo-prewarm] redis unavailable` 접두는 13-seo-prewarm.sh의
    // CloudWatch metric filter와 같은 마커라, "redis 미구성"과 "락 획득이 던짐" 두 경로를 필터 하나로 잡는다.
    let token: string | null;
    try {
        // 배치 표식: 락 명령도 배치용 Redis 클라이언트(긴 timeout)로 보낸다(아래 본문과 같다).
        token = await runAsBatchWork(() => acquirePrewarmLock());
    } catch (error) {
        console.error(
            '[seo-prewarm] redis unavailable — lock acquire threw:',
            error
        );
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }
    if (token === null) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }
    const lockToken = token;
    const lockAcquiredAtMs = Date.now();
    // SIGTERM 시 Redis 락 해제가 끝날 때까지 drain이 기다리도록 afterWithDrain으로 등록한다. after()만 쓰면
    // SIGTERM의 process.exit 직후 콜백이 고아가 되어 락이 TTL(900초)까지 잠기고, 다음 호출이 그만큼 기다린다.
    //
    // `runAsBatchWork`: 배치 안의 FMP·Redis 호출은 렌더 예산(3초·429 대기 없음)이 아니라 배치 정책
    // (긴 timeout·429 대기)을 쓴다 — 배치가 렌더 래퍼(`getAssetInfoResilient` 등)를 거쳐도 마찬가지다
    // (`renderBudget.ts`).
    afterWithDrain(() =>
        runAsBatchWork(() => runSeoPrewarmJob(lockToken, lockAcquiredAtMs))
    );
    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
