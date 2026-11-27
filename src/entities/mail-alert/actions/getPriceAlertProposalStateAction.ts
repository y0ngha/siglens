'use server';

import { isPriceAlertLaunched } from '../lib/priceAlertConstants';
import type { PriceAlertProposalState } from '../model';
import { createPriceAlertDeps } from '../server/createPriceAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { getPriceAlertProposalState } from '../server/priceAlertFlows';

const UNAVAILABLE: PriceAlertProposalState = { status: 'unavailable' };

/** 카드가 마운트될 때 이 제안의 상태를 읽는다. 공개 전에는 아무것도 읽지 않고 `unavailable`이다. */
export async function getPriceAlertProposalStateAction(
    token: unknown
): Promise<PriceAlertProposalState> {
    if (!isPriceAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[getPriceAlertProposalStateAction] failed:',
        UNAVAILABLE,
        async () =>
            getPriceAlertProposalState(await createPriceAlertDeps(), token)
    );
}
