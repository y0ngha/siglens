import type { PriceAlertProposal } from '@/entities/mail-alert/model';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { formatPrice } from '@/shared/lib/priceFormat';

/** 알림 시장(`us`·`kr`)의 가격 서식 — 시장 프로필 레지스트리의 통화·소수 자릿수 규칙을 그대로 쓴다. */
export function formatAlertPrice(
    value: number,
    market: PriceAlertProposal['market']
): string {
    const profile = market === 'us' ? 'us-equity' : 'kr-equity';
    return formatPrice(value, getDescriptor(profile).priceFormat);
}

/**
 * 카드 문장의 종목 표기: 이름이 있으면 `이름(코드)`, 없으면 코드. 한국 종목의 거래소 접미사(`.KS`·`.KQ`)는 야후 규약이라
 * 화면에서는 단축 코드로 보인다.
 */
export function alertSymbolLabel(symbol: string, name: string | null): string {
    const code = symbol.replace(KR_EXCHANGE_SUFFIX_RE, '');
    return name === null || name === '' ? code : `${name}(${code})`;
}
