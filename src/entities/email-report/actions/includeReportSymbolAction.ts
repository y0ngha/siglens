'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleEmailReportExclusionRepository } from '@/entities/email-report/api';
import { parseReportSymbolInput } from '../lib/parseReportSymbolInput';
import type { RawReportSymbolInput, ReportSymbolActionResult } from '../model';

/**
 * 리포트에서 뺀 종목을 다시 넣는다. 뺀 적 없는 심볼도 성공으로 본다(결과가 같다 — 멱등).
 * 던지지 않고 결과를 돌려준다(SA-1).
 */
export async function includeReportSymbolAction(
    input: RawReportSymbolInput
): Promise<ReportSymbolActionResult> {
    const t = await getTranslations('entities.email-report.action');

    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }
    const parsed = parseReportSymbolInput(input);
    if (!parsed.ok) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidSymbol'),
        };
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzleEmailReportExclusionRepository(db).includeSymbol(
            user.id,
            parsed.symbol
        );
        return { status: 'ok' };
    } catch (error) {
        logActionError('[includeReportSymbolAction] include failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('includeFailed'),
        };
    }
}
