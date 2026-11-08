import { hashUsageIp } from '@y0ngha/siglens-core';
import { getClientIp } from '@/shared/api/getClientIp';
import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';
import { INQUIRY_HONEYPOT_FIELD } from '@/shared/config/contact';

/**
 * 봇 함정 입력이 채워졌는지. 채워졌으면 호출 액션은 단서를 주지 않도록 성공처럼 응답하고
 * 저장·메일을 하지 않는다.
 */
export function isHoneypotFilled(formData: FormData): boolean {
    const value = formData.get(INQUIRY_HONEYPOT_FIELD);
    return typeof value === 'string' && value !== '';
}

const INQUIRY_LIMIT_PER_HOUR = 5;
const WINDOW_SECONDS = 3600;

/**
 * 문의 계열 제출(문의 폼, 종목 요청)을 IP 해시 기준 시간당 횟수로 제한한다. 두 폼이 같은
 * `inquiry:rl:` 키를 나눠 쓰므로 한쪽으로 우회할 수 없다. Redis 장애는 통과(fail-open).
 *
 * @returns true = 한도 초과(거절), false = 허용
 */
export async function isInquiryRateLimited(): Promise<boolean> {
    const ipHash = hashUsageIp(await getClientIp(), new Date());
    return !(await checkFixedWindowRateLimit({
        key: `inquiry:rl:${ipHash}`,
        limit: INQUIRY_LIMIT_PER_HOUR,
        windowSeconds: WINDOW_SECONDS,
        logTag: 'isInquiryRateLimited',
    }));
}
