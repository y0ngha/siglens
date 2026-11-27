'use server';

import {
    isMailAlertLaunched,
    MAIL_ALERT_HONEYPOT_FIELD,
} from '../lib/mailAlertConstants';
import type { MailAlertRequestCodeState } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { requestMailAlertCodeFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertRequestCodeState = { status: 'unavailable' };

function readText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}

/** 1단계: 입력한 주소로 인증 코드를 보낸다(주소·IP별 한도, 봇 함정 입력). */
export async function requestMailAlertCodeAction(
    _prev: MailAlertRequestCodeState,
    formData: FormData
): Promise<MailAlertRequestCodeState> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[requestMailAlertCodeAction] failed:',
        UNAVAILABLE,
        async () =>
            requestMailAlertCodeFlow(await createMailAlertDeps(), {
                email: readText(formData, 'email'),
                honeypotFilled:
                    readText(formData, MAIL_ALERT_HONEYPOT_FIELD) !== '',
            })
    );
}
