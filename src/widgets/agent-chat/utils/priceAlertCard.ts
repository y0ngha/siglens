import { formatSymbolLabel } from '@/entities/ticker/lib/ticker';
import { displayTicker } from '@/shared/lib/displayTicker';

/**
 * 카드 문장의 종목 표기 — 메일의 `reportSymbolLabel`과 같은 규칙(`formatSymbolLabel`)이다. 한국 종목의 거래소
 * 접미사(`.KS`·`.KQ`)는 야후 규약이라 화면에서는 단축 코드로 보인다.
 */
export function alertSymbolLabel(symbol: string, name: string | null): string {
    return formatSymbolLabel(displayTicker(symbol), name, symbol);
}
