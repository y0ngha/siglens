import 'server-only';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { createUserEmailLookup } from '@/entities/auth/server/createUserEmailLookup';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';
import { createEmailTokenStore } from '@/entities/email-token/api';
import { getClientIp } from '@/shared/api/getClientIp';
import { checkFixedWindowRateLimit } from '@/shared/cache/fixedWindowRateLimit';
import { getRedisReaderWriter } from '@/shared/cache/redisClient';
import { getDatabaseClient } from '@/shared/db/client';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import {
    DrizzleMailAlertSubscriberRepository,
    DrizzlePriceAlertRepository,
} from '../api';
import { isSubscriberId } from '../lib/mailAlertCookie';
import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import { isPriceAlertLaunched } from '../lib/priceAlertConstants';
import { buildMailAlertCodeEmail } from '../templates/mailAlertCodeEmail';
import { createMailAlertGuestCookie } from './mailAlertGuestCookie';
import type { MailAlertFlowDeps } from './mailAlertFlows';

const RATE_LIMIT_LOG_TAG = 'mailAlertRateLimit';

/**
 * 알림 메일 액션과 설정 화면이 쓰는 실제 의존성. 공개 스위치가 꺼진 동안에는 호출자가 먼저 돌려보내므로
 * 여기까지 오지 않는다. 서명 비밀이 없으면 쿠키·링크 서명이 불가능해 `signingReady`가 거짓이고, 그때
 * 흐름은 신청을 받지 않는다(수신거부 링크가 안 되는 메일을 만들지 않으려고).
 */
export async function createMailAlertDeps(): Promise<MailAlertFlowDeps> {
    const secret = readEmailReportSecret();
    const { db } = getDatabaseClient();
    const locale = await resolveRequestLocale();
    const tCode = await getTranslations({
        locale,
        namespace: 'entities.mail-alert.codeEmail',
    });
    return {
        launched: isMailAlertLaunched(),
        signingReady: secret !== null,
        subscribers: new DrizzleMailAlertSubscriberRepository(db),
        priceAlerts: new DrizzlePriceAlertRepository(db),
        priceAlertsEnabled: isPriceAlertLaunched(),
        users: createUserEmailLookup(db),
        currentUser: getCurrentUser,
        guestCookie: createMailAlertGuestCookie(secret ?? ''),
        verifyLink: link =>
            secret !== null &&
            isSubscriberId(link.s) &&
            verifyReportValue(secret, 'alert-manage', link.s, link.sig),
        rateLimit: rule =>
            checkFixedWindowRateLimit({
                ...rule,
                logTag: RATE_LIMIT_LOG_TAG,
            }),
        resetCounter: async key => {
            await getRedisReaderWriter()?.writer.del(key);
        },
        ipHash: async () => hashUsageIp(await getClientIp(), new Date()),
        emailTokens: createEmailTokenStore(),
        emailDispatcher: createEmailDispatcher(),
        buildCodeMessage: (to, code) =>
            buildMailAlertCodeEmail({ to, code, locale, t: tCode }),
        locale,
    };
}
