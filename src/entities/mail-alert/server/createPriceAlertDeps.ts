import 'server-only';

import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { readGuestId } from '@/shared/api/guestId';
import { getDatabaseClient } from '@/shared/db/client';
import { guestSubject } from '@/shared/lib/guestSubject';
import { getAssetInfo } from '@/entities/ticker/server/getAssetInfo';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { DrizzlePriceAlertRepository } from '../api';
import { createMailAlertDeps } from './createMailAlertDeps';
import { readPriceAlertReference } from './priceAlertReference';
import {
    priceAlertSubject,
    verifyPriceAlertProposal,
} from './priceAlertProposalToken';
import type { PriceAlertFlowDeps } from './priceAlertFlows';

/**
 * 가격대 알림 액션이 쓰는 실제 의존성: 알림 메일 흐름의 의존성에 알림 저장소와 제안 토큰 검증을 더한다.
 * 호출자의 해시는 에이전트 도구가 제안을 만들 때 쓴 주체(`ctx.userId`: 회원 id 또는 `guest:<쿠키 id>`)와 같은
 * 규칙으로 만든다 — 그래야 같은 사람에게만 토큰이 통한다. 서명 비밀이 없으면 검증도 해시도 만들 수 없어 모든
 * 토큰이 거절된다.
 */
export async function createPriceAlertDeps(): Promise<PriceAlertFlowDeps> {
    const base = await createMailAlertDeps();
    const secret = readEmailReportSecret();
    return {
        ...base,
        priceAlerts: new DrizzlePriceAlertRepository(getDatabaseClient().db),
        verifyProposal: token =>
            secret === null ? null : verifyPriceAlertProposal(secret, token),
        callerSubject: async () => {
            if (secret === null) return null;
            const user = await base.currentUser();
            if (user !== null) return priceAlertSubject(secret, user.id);
            const guestId = await readGuestId();
            return guestId === null
                ? null
                : priceAlertSubject(secret, guestSubject(guestId));
        },
        readReference: async (proposal, startsAfterSession, now) => {
            const asset = await getAssetInfo(proposal.symbol).catch(
                (error: unknown) => {
                    console.error(
                        '[createPriceAlertDeps] asset lookup failed:',
                        redactDbErrorForLog(error)
                    );
                    return null;
                }
            );
            return readPriceAlertReference({
                symbol: proposal.symbol,
                quoteSymbol: asset?.fmpSymbol ?? proposal.symbol,
                profile: marketProfileForAssetInfo(asset),
                startsAfterSession,
                now,
            });
        },
        now: Date.now,
    };
}
