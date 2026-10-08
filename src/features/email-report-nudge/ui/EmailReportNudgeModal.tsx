'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import { MailIcon, PortfolioIcon } from '@/shared/ui/StrokeIcons';
import type { EmailReportNudge } from '../hooks/useEmailReportNudge';

interface EmailReportNudgeModalProps {
    nudge: EmailReportNudge;
    onClose: () => void;
}

const TITLE_ID = 'email-report-nudge-title';
const ACTION_SIZE = 'h-10 px-4 text-sm';
/** 계정 페이지의 메일 리포트 섹션 앵커(`app/[locale]/account/page.tsx`). */
const SETTINGS_HREF = '/account#email-report';

/**
 * 회원 메일 리포트 넛지 모달. 정보 제공 톤만 쓴다 — 수익이나 매매 판단을 암시하지 않는다.
 * 셸은 가입 넛지(`AnalysisSignupNudgeModal`)와 같다(포커스 트랩·Esc·배경 클릭 닫기).
 */
export function EmailReportNudgeModal({
    nudge,
    onClose,
}: EmailReportNudgeModalProps) {
    const t = useTranslations('features.email-report-nudge');
    const isSetup = nudge.kind === 'setup';
    const href = isSetup
        ? SETTINGS_HREF
        : `/portfolio?symbol=${encodeURIComponent(nudge.symbol)}`;

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                {isSetup ? (
                    <MailIcon className="size-8 text-primary-400" />
                ) : (
                    <PortfolioIcon className="size-8 text-primary-400" />
                )}
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {isSetup
                        ? t('EmailReportNudgeModal.7e84b8')
                        : t('EmailReportNudgeModal.5da22e')}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
                    {isSetup
                        ? t('EmailReportNudgeModal.daa53b', {
                              v0: nudge.holdingsCount,
                          })
                        : t('EmailReportNudgeModal.15049a', {
                              v0: nudge.symbol,
                          })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href={href}
                    onClick={onClose}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {isSetup
                        ? t('EmailReportNudgeModal.8be329')
                        : t('EmailReportNudgeModal.4a3bb0')}
                </Link>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('EmailReportNudgeModal.0fcd14')}
                </button>
            </div>
        </ModalShell>
    );
}
