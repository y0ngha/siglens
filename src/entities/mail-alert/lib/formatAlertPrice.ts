import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { formatPrice } from '@/shared/lib/priceFormat';
import type { PriceAlertView } from '../model';

/**
 * 가격대 알림 가격의 서식 — 시장 프로필 레지스트리의 통화·소수 자릿수 규칙을 그대로 쓴다(종목 화면과 같은 `$126.98`).
 * 대화의 알림 카드, 알림 설정 화면, 알림 메일이 같은 값을 같은 글자로 보이도록 모두 이 함수를 쓴다.
 */
export function formatAlertPrice(
    value: number,
    market: PriceAlertView['market']
): string {
    const profile = market === 'us' ? 'us-equity' : 'kr-equity';
    return formatPrice(value, getDescriptor(profile).priceFormat);
}
