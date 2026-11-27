import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

/** `isKrEquitySymbol`이 대소문자를 가리지 않으므로 접미사 제거도 같은 범위로 맞춘다. */
const KR_EXCHANGE_SUFFIX_CI_RE = new RegExp(KR_EXCHANGE_SUFFIX_RE.source, 'i');

/**
 * 사용자에게 보이는 티커 표기. 국내 상장 종목은 거래소 접미사(`.KS`/`.KQ`, 대소문자 무관)를 뗀다 —
 * 접미사는 yahoo 벤더 규약이고 사람이 아는 코드는 `005930`이다.
 *
 * **표기에만 쓴다.** URL·서명·라우팅 식별자는 접미사가 있어야 종목을 특정하므로 원문을 그대로 둔다.
 */
export function displayTicker(symbol: string): string {
    return isKrEquitySymbol(symbol)
        ? symbol.replace(KR_EXCHANGE_SUFFIX_CI_RE, '')
        : symbol;
}
