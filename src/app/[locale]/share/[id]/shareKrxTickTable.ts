import 'server-only';
import type { KrxTickTable } from '@y0ngha/siglens-core';
import type { ShareableKind } from '@/shared/db/constants';
import { resolveKrxTickTableForDisplay } from '@/entities/ticker/lib/resolveKrxTickTable';

/**
 * 공유 화면의 가격 카드가 쓸 KRX 호가표. 가격 카드(키레벨·목표가)는 차트 종류에만 있어 그때만
 * 조회하고, 다른 종류는 I/O 없이 기본 주식 표를 돌려준다(값을 쓰지 않는다).
 */
export function shareKrxTickTable(
    kind: ShareableKind,
    ticker: string
): Promise<KrxTickTable> {
    return kind === 'chart'
        ? resolveKrxTickTableForDisplay(ticker)
        : Promise.resolve('share');
}
