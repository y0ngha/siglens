'use server';

import { getTranslations } from 'next-intl/server';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleEmailReportSubscriptionRepository } from '@/entities/email-report/api';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { unsubscribeWithSignature } from '@/entities/email-report/unsubscribeWithSignature';
import type {
    UnsubscribeEmailReportInput,
    UnsubscribeEmailReportResult,
} from '../model';

/**
 * 메일의 수신거부 링크로 들어온 확인 페이지에서 수신을 끈다. 로그인을 요구하지 않는다 —
 * 링크의 서명이 본인 확인이다. 던지지 않고 결과를 돌려준다(SA-1).
 */
export async function unsubscribeEmailReportAction(
    input: UnsubscribeEmailReportInput
): Promise<UnsubscribeEmailReportResult> {
    const t = await getTranslations('entities.email-report.action');
    const userId = typeof input?.userId === 'string' ? input.userId : '';
    const signature =
        typeof input?.signature === 'string' ? input.signature : '';
    try {
        const { db } = getDatabaseClient();
        const outcome = await unsubscribeWithSignature(
            new DrizzleEmailReportSubscriptionRepository(db),
            readEmailReportSecret(),
            userId,
            signature
        );
        return outcome === 'ok'
            ? { status: 'ok' }
            : {
                  status: 'error',
                  code: 'invalid_link',
                  message: t('invalidUnsubscribeLink'),
              };
    } catch (error) {
        logActionError('[unsubscribeEmailReportAction] disable failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('unsubscribeFailed'),
        };
    }
}
