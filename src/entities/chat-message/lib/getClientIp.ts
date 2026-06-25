import 'server-only';
import { headers } from 'next/headers';

/**
 * x-forwarded-for 헤더 첫 번째 IP를 반환한다.
 * Cloudflare/ALB 뒤에서는 실 클라이언트 IP가 헤더 첫 값으로 삽입된다.
 * 헤더가 없거나 파싱 실패 시 'unknown'을 반환한다.
 */
export async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}
