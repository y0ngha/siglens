'use server';

import { readLinkAuth } from '../lib/linkAuth';
import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertChangeResult, MailAlertLinkAuth } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { removeMailAlertTopicFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertChangeResult = { status: 'unavailable' };

/** 항목 하나를 그만 받는다. 소유자는 세션, 메일 속 서명 링크(`link`), 쿠키 순으로 서버가 정한다. */
export async function removeMailAlertTopicAction(
    topicInput: unknown,
    link?: MailAlertLinkAuth
): Promise<MailAlertChangeResult> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[removeMailAlertTopicAction] failed:',
        UNAVAILABLE,
        async () =>
            removeMailAlertTopicFlow(
                await createMailAlertDeps(),
                topicInput,
                readLinkAuth(link)
            )
    );
}
