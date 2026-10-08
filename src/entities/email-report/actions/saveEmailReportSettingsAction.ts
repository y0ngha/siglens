'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleEmailReportSubscriptionRepository } from '@/entities/email-report/api';
import { toSettingsView } from '../lib/toSettingsView';
import { validateEmailReportSettings } from '../lib/validateEmailReportSettings';
import { weekdaysToMask } from '../lib/weekdayMask';
import type {
    EmailReportActionErrorCode,
    RawEmailReportSettingsInput,
    SaveEmailReportSettingsResult,
} from '../model';

/** 오류 코드 → `entities.email-report.action` 키. */
const MESSAGE_KEY: Record<EmailReportActionErrorCode, string> = {
    unauthenticated: 'unauthenticated',
    invalid_days: 'invalidDays',
    invalid_hour: 'invalidHour',
    invalid_timezone: 'invalidTimezone',
    invalid_input: 'invalidInput',
    storage_unavailable: 'saveFailed',
};

/**
 * Server Action 인자는 선언 타입과 무관하게 클라이언트가 임의 JSON을 보낼 수 있다.
 * `validateEmailReportSettings`가 필드 타입을 가정하므로 모양부터 좁힌다.
 */
function isRawInputShape(input: unknown): input is RawEmailReportSettingsInput {
    if (typeof input !== 'object' || input === null) return false;
    const candidate = input as Record<string, unknown>;
    return (
        typeof candidate.enabled === 'boolean' &&
        Array.isArray(candidate.daysOfWeek) &&
        typeof candidate.sendHour === 'number' &&
        typeof candidate.timezone === 'string'
    );
}

/**
 * 회원의 메일 리포트 수신 설정을 저장한다. 던지지 않고 결과를 돌려준다(SA-1).
 *
 * 메일 본문 로케일은 저장 요청의 로케일로 정한다 — 회원이 보고 있는 화면 언어가
 * 받고 싶은 메일 언어라는 가정이다.
 */
export async function saveEmailReportSettingsAction(
    input: RawEmailReportSettingsInput
): Promise<SaveEmailReportSettingsResult> {
    const t = await getTranslations('entities.email-report.action');
    const fail = (
        code: EmailReportActionErrorCode
    ): SaveEmailReportSettingsResult => ({
        status: 'error',
        code,
        message: t(MESSAGE_KEY[code]),
    });

    const user = await getCurrentUser();
    if (user === null) return fail('unauthenticated');
    if (!isRawInputShape(input)) return fail('invalid_input');

    const v = validateEmailReportSettings(input);
    if (!v.ok) return fail(v.code);

    try {
        const locale = await resolveRequestLocale();
        const { db } = getDatabaseClient();
        const record = await new DrizzleEmailReportSubscriptionRepository(
            db
        ).upsert({
            userId: user.id,
            enabled: v.enabled,
            daysOfWeek: weekdaysToMask(v.daysOfWeek),
            sendHour: v.sendHour,
            timezone: v.timezone,
            locale,
        });
        return { status: 'ok', settings: toSettingsView(record) };
    } catch (error) {
        logActionError('[saveEmailReportSettingsAction] upsert failed', error);
        return fail('storage_unavailable');
    }
}
