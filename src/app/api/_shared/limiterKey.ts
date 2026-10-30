import { getClientIp } from '@/shared/api/getClientIp';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';

/**
 * 공개 라우트(`/api/client-error`·`/api/search`)의 IP별 한도 키.
 *
 * **던지지 않는다** — IP 해석(`headers()`)이 실패해도 요청 처리 자체는 살아 있어야 한다.
 * 실패하면 공용 버킷 하나로 센다. 상한은 그대로 걸리므로 남용 방어도 유지된다.
 */
export async function resolveLimiterKey(): Promise<string> {
    try {
        return await getClientIp();
    } catch {
        return UNKNOWN_CLIENT_IP;
    }
}
