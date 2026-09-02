import 'server-only';
import { headers } from 'next/headers';

/**
 * 클라이언트 IP를 반환한다. 없으면 `'unknown'`.
 *
 * **`cf-connecting-ip`를 먼저 본다.** Cloudflare가 매 요청 이 헤더를 직접
 * 덮어쓰므로 호출자가 위조할 수 없다.
 *
 * `x-forwarded-for`의 첫 값을 쓰면 안 되는 이유: Cloudflare도 ALB도 그 헤더를
 * 덮어쓰지 않고 **뒤에 덧붙인다.** 호출자가 `X-Forwarded-For: 1.2.3.4`를 담아
 * 보내면 앱에는 `1.2.3.4, <진짜 IP>`가 도착하고, 첫 값은 호출자가 심은 값이다.
 * 이 함수의 소비자는 방문자 집계(`/api/presence`)와 사용량 제한
 * (`chatAction`·`getRemainingTokensAction`·`createShareSnapshotAction`)이라,
 * 위조가 통하면 통계가 부풀려지고 제한이 우회된다.
 *
 * ⚠️ **폴백은 여전히 위조 가능하다.** `cf-connecting-ip`가 없다는 것은
 * Cloudflare를 거치지 않았다는 뜻이고, 그때는 `x-forwarded-for`의 첫 값으로
 * 되돌아간다. 여기서 "마지막 값"을 쓰는 편이 더 견고해 보이지만, 신뢰할 수 있는
 * 프록시 홉 수가 이 저장소 어디에도 검증돼 있지 않다 — 잘못 짚으면 모든 사용자가
 * 프록시 IP 하나로 뭉쳐 사용량 제한이 조용히 망가진다. 근본 완화는 코드가 아니라
 * 인프라다(오리진을 Cloudflare IP로만 열기 / Authenticated Origin Pulls).
 */
export async function getClientIp(): Promise<string> {
    const headersList = await headers();

    const cloudflareIp = headersList.get('cf-connecting-ip')?.trim();
    if (cloudflareIp) return cloudflareIp;

    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}
