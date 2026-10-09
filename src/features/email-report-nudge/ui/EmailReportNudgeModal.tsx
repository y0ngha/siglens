'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import { cn } from '@/shared/lib/cn';
import type { ContextOf } from '@/shared/lib/funnel/funnelEvents';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
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
/** 메일 리포트 설정 페이지(`app/[locale]/email-report/page.tsx`). */
const SETTINGS_HREF = '/email-report';

/**
 * 회원 메일 리포트 넛지 모달. 정보 제공 톤만 쓴다 — 수익이나 매매 판단을 암시하지 않는다.
 * 셸은 가입 넛지(`AnalysisSignupNudgeModal`)와 같다(포커스 트랩·Esc·배경 클릭 닫기).
 */
export function EmailReportNudgeModal({
    nudge,
    onClose,
}: EmailReportNudgeModalProps) {
    const t = useTranslations('features.email-report-nudge');
    // 넛지 종류별 아이콘·문구·이동 경로를 한 번에 정한다. `kind`가 늘면 switch가 컴파일
    // 오류(빠진 분기)로 드러난다.
    const content = ((): {
        Icon: typeof MailIcon;
        title: string;
        body: string;
        cta: string;
        href: string;
        funnel: ContextOf<'nudge_clicked'>;
    } => {
        switch (nudge.kind) {
            case 'setup':
                return {
                    Icon: MailIcon,
                    title: t('EmailReportNudgeModal.7e84b8'),
                    body: t('EmailReportNudgeModal.daa53b', {
                        v0: nudge.holdingsCount,
                    }),
                    cta: t('EmailReportNudgeModal.8be329'),
                    href: SETTINGS_HREF,
                    funnel: { kind: 'member_setup', cta: 'settings' },
                };
            case 'symbol':
                return {
                    Icon: PortfolioIcon,
                    title: t('EmailReportNudgeModal.5da22e'),
                    body: t('EmailReportNudgeModal.15049a', {
                        v0: nudge.symbol,
                    }),
                    cta: t('EmailReportNudgeModal.4a3bb0'),
                    href: `/portfolio?symbol=${encodeURIComponent(nudge.symbol)}`,
                    funnel: { kind: 'member_symbol', cta: 'add' },
                };
        }
    })();
    const { Icon } = content;

    useFunnelNudgeShown({ kind: content.funnel.kind });

    const handleCtaClick = (): void => {
        trackFunnelEvent('nudge_clicked', content.funnel);
        onClose();
    };

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <Icon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {content.title}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
                    {content.body}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href={content.href}
                    onClick={handleCtaClick}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {content.cta}
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
