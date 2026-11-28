import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

/**
 * 카드 문장의 종목 표기: 이름이 있으면 `이름(코드)`, 없으면 코드. 한국 종목의 거래소 접미사(`.KS`·`.KQ`)는 야후 규약이라
 * 화면에서는 단축 코드로 보인다.
 */
export function alertSymbolLabel(symbol: string, name: string | null): string {
    const code = symbol.replace(KR_EXCHANGE_SUFFIX_RE, '');
    return name === null || name === '' ? code : `${name}(${code})`;
}
