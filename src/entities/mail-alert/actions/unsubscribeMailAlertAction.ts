'use server';

import { readLinkAuth } from '../lib/linkAuth';
import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertChangeResult, MailAlertLinkAuth } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { unsubscribeMailAlertFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertChangeResult = { status: 'unavailable' };

/** 알림 메일을 모두 그만 받는다(구독자 삭제). 소유자는 서버가 세션·서명 링크·쿠키 순으로 정한다. */
export async function unsubscribeMailAlertAction(
    link?: MailAlertLinkAuth
): Promise<MailAlertChangeResult> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[unsubscribeMailAlertAction] failed:',
        UNAVAILABLE,
        async () =>
            unsubscribeMailAlertFlow(
                await createMailAlertDeps(),
                readLinkAuth(link)
            )
    );
}
