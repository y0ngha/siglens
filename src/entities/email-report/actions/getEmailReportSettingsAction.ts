'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleEmailReportSubscriptionRepository } from '@/entities/email-report/api';
import { toSettingsView } from '../lib/toSettingsView';
import type { EmailReportSettingsView } from '../model';

/**
 * 현재 회원의 메일 리포트 수신 설정. 비로그인이면 `null` — redirect하지 않는다.
 *
 * 조회 실패는 삼키지 않고 던진다(`getPortfolioHoldingsAction`과 같은 계약). React Query
 * `queryFn`으로 돌기 때문에 던지면 `isError`가 켜질 뿐이다. 여기서 기본값으로 삼키면
 * 일시적인 DB 오류가 "수신 꺼짐"으로 보이고, 그 화면에서 저장하면 실제 설정을 덮어쓴다.
 */
export async function getEmailReportSettingsAction(): Promise<EmailReportSettingsView | null> {
    const user = await getCurrentUser();
    if (user === null) return null;

    const { db } = getDatabaseClient();
    const record = await new DrizzleEmailReportSubscriptionRepository(
        db
    ).findByUser(user.id);
    return toSettingsView(record);
}
