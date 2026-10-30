'use client';

import { useTranslations } from 'next-intl';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { EmailReportSettingsForm } from './EmailReportSettingsForm';

const RETRY_BUTTON = cn(BUTTON_OUTLINE, 'h-9 px-3 text-sm');

function SettingsSkeleton() {
    const t = useTranslations('features.email-report-settings');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">
                {t('EmailReportSettingsSection.e61b39')}
            </span>
            <div className="space-y-3" aria-hidden="true">
                <div className="h-16 animate-pulse rounded-lg bg-secondary-700" />
                <div className="h-10 w-2/3 animate-pulse rounded-lg bg-secondary-700" />
            </div>
        </div>
    );
}

interface SettingsLoadErrorProps {
    readonly onRetry: () => void;
}

function SettingsLoadError({ onRetry }: SettingsLoadErrorProps) {
    const t = useTranslations('features.email-report-settings');
    return (
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary-300">
            <p role="alert">{t('EmailReportSettingsSection.4ba4b5')}</p>
            <button type="button" className={RETRY_BUTTON} onClick={onRetry}>
                {t('EmailReportSettingsSection.0c767c')}
            </button>
        </div>
    );
}

function SettingsBody() {
    const { settings, isPending, isError, refetch, save } =
        useEmailReportSettings();

    if (isPending) return <SettingsSkeleton />;
    if (isError || !settings) return <SettingsLoadError onRetry={refetch} />;
    // 폼은 마운트 시점 값으로 시작하고 이후 refetch를 따라가지 않는다. 저장 응답으로
    // 캐시가 바뀔 때 다시 마운트하면 저장 버튼의 포커스와 상태 문구가 사라진다.
    // 다른 탭에서 바꾼 값은 마지막 저장이 이긴다.
    return <EmailReportSettingsForm initial={settings} save={save} />;
}

/**
 * 정기 메일 리포트 수신 설정 폼. `/email-report` 페이지가 쓴다 — 제목과 안내는 페이지
 * 헤더가 맡는다. 조회 중·실패·폼 세 상태를 고른다.
 */
export function EmailReportSettingsSection() {
    return (
        <div className="space-y-4">
            <SettingsBody />
        </div>
    );
}
