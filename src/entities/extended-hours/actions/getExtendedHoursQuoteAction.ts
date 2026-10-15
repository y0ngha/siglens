'use server';

import { loadExtendedHoursQuote } from '../api';
import type { ExtendedHoursQuote } from '../model';

/**
 * 프리·애프터마켓 한 줄 시세(표시 전용). 계약은 `loadExtendedHoursQuote`와 같고, 던지지
 * 않는다 — 어떤 실패든 `null`("표시 없음")로 접는다(SERVER.md#SA-1).
 *
 * 인자는 심볼뿐이고 회원 데이터를 만지지 않는다. 비회원에게도 열려 있는 종목 페이지의
 * 보조 표시다.
 */
export async function getExtendedHoursQuoteAction(
    symbol: string
): Promise<ExtendedHoursQuote | null> {
    try {
        return await loadExtendedHoursQuote(symbol);
    } catch (error) {
        console.error('[getExtendedHoursQuoteAction] failed:', {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
        return null;
    }
}
