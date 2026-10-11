'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleEmailReportExclusionRepository } from '@/entities/email-report/api';
import { EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS } from '../lib/emailReportConstants';
import { parseReportSymbolInput } from '../lib/parseReportSymbolInput';
import type { RawReportSymbolInput, ReportSymbolActionResult } from '../model';

/**
 * 회원의 메일 리포트에서 종목 하나를 뺀다. 보유·관심종목 목록은 그대로 두고 리포트 선택만
 * 바뀐다. 이미 뺀 심볼은 상한과 무관하게 멱등 성공이다. 던지지 않고 결과를 돌려준다(SA-1).
 */
export async function excludeReportSymbolAction(
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
        const outcome = await new DrizzleEmailReportExclusionRepository(
            db
        ).excludeSymbol(
            user.id,
            parsed.symbol,
            EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS
        );
        if (outcome === 'limit_reached') {
            return {
                status: 'error',
                code: 'limit_reached',
                message: t('excludeLimitReached', {
                    v0: EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS,
                }),
            };
        }
        return { status: 'ok' };
    } catch (error) {
        // Drizzle 오류 메시지는 바인딩 파라미터(user id·심볼)를 품는다 — 코드만 남긴다.
        logActionError('[excludeReportSymbolAction] exclude failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('excludeFailed'),
        };
    }
}
