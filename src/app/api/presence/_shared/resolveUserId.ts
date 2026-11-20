import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { describeDbErrorForLog } from '@/shared/db/describeDbErrorForLog';

/**
 * 비콘을 보낸 회원의 id. `getCurrentUser`는 세션 쿠키가 없으면 DB를 건드리지 않고
 * null을 준다 — 비회원 다수에게 비용 0. 조회 실패는 비회원으로 접는다. 집계가 회원
 * 확정에 가로막히면 안 되고, 실패가 로그 없이 사라지면 안 된다(`SERVER.md#SA-4`).
 */
export async function resolveUserId(logTag: string): Promise<string | null> {
    try {
        return (await getCurrentUser())?.id ?? null;
    } catch (error) {
        // 에러 객체를 통째로 남기지 않는다: 세션 조회 쿼리의 파라미터가 **세션 토큰 원문**이고, drizzle은
        // 파라미터를 에러 메시지에 넣는다. 이름과 DB 코드만 남긴다(`describeDbErrorForLog`).
        console.error(
            `${logTag} getCurrentUser failed: ${describeDbErrorForLog(error)}`
        );
        return null;
    }
}
