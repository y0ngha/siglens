'use server';

import { isPriceAlertLaunched } from '../lib/priceAlertConstants';
import type { PriceAlertCreateResult } from '../model';
import { createPriceAlertDeps } from '../server/createPriceAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { createPriceAlertFlow } from '../server/priceAlertFlows';

const UNAVAILABLE: PriceAlertCreateResult = { status: 'unavailable' };

/**
 * 카드의 "알림 만들기" 버튼. 에이전트에는 쓰기 경로가 없다 — 알림은 이 액션이 사용자의 클릭으로만 만든다.
 * 토큰의 서명·만료·소유자와 IP 한도를 확인한 뒤 호출자의 구독자 행에 만들고, 확인된 주소가 없으면 `needs_code`다.
 */
export async function createPriceAlertAction(
    token: unknown
): Promise<PriceAlertCreateResult> {
    if (!isPriceAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[createPriceAlertAction] failed:',
        UNAVAILABLE,
        async () => createPriceAlertFlow(await createPriceAlertDeps(), token)
    );
}
