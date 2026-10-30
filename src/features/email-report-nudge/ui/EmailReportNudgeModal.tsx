'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import { cn } from '@/shared/lib/cn';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import { MailIcon, PortfolioIcon } from '@/shared/ui/StrokeIcons';
import { useFocusWhenAdded } from '../hooks/useFocusWhenAdded';
import { useNudgeWatchlistAdd } from '../hooks/useNudgeWatchlistAdd';
import type { EmailReportNudge } from '../lib/nudgeDecisions';

interface EmailReportNudgeModalProps {
    /** 띄울 넛지 — 종류에 따라 설정 권유 또는 종목 담기 권유를 그린다. */
    nudge: EmailReportNudge;
    /** 닫기(나중에·Esc·배경 클릭·설정 이동). 호스트가 같은 넛지를 다시 띄우지 않는다. */
    onClose: () => void;
}

const TITLE_ID = 'email-report-nudge-title';
/**
 * 본문 설명의 id. 패널에 포커스를 두는 안내형 모달이라 `aria-describedby`가 없으면
 * 스크린리더가 제목만 읽고 무엇을 보내 주는지(본문)는 건너뛴다.
 */
const DESCRIPTION_ID = 'email-report-nudge-description';
const ACTION_SIZE = 'h-10 px-4 text-sm';
const PANEL_CLASS =
    'max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700';
/**
 * 메일 리포트 설정 페이지(`app/[locale]/email-report/page.tsx`). `from=nudge`는 설정 페이지가
 * `report_enabled` 이벤트의 출처로 읽는다.
 */
const SETTINGS_HREF = '/email-report?from=nudge';

/**
 * 회원 메일 리포트 넛지 모달. 정보 제공 톤만 쓴다 — 수익이나 매매 판단을 암시하지 않는다.
 * 셸은 가입 넛지(`AnalysisSignupNudgeModal`)와 같다(포커스 트랩·Esc·배경 클릭 닫기).
 * 종목 권유의 CTA는 페이지 이동 없이 관심종목 담기를 바로 실행한다.
 */
export function EmailReportNudgeModal({
    nudge,
    onClose,
}: EmailReportNudgeModalProps) {
    switch (nudge.kind) {
        case 'setup':
            return (
                <SetupNudgeModal
                    symbolCount={nudge.symbolCount}
                    onClose={onClose}
                />
            );
        case 'symbol':
            return <SymbolNudgeModal symbol={nudge.symbol} onClose={onClose} />;
    }
}

interface SetupNudgeModalProps {
    /** 보유∪관심 종목 수 — 본문의 "N개"에 들어간다. */
    symbolCount: number;
    onClose: () => void;
}

function SetupNudgeModal({ symbolCount, onClose }: SetupNudgeModalProps) {
    const t = useTranslations('features.email-report-nudge');
    useFunnelNudgeShown({ kind: 'member_setup' });

    const handleCtaClick = (): void => {
        trackFunnelEvent('nudge_clicked', {
            kind: 'member_setup',
            cta: 'settings',
        });
        onClose();
    };

    return (
        <ModalShell
            titleId={TITLE_ID}
            descriptionId={DESCRIPTION_ID}
            onClose={onClose}
            focusPanel
            className={PANEL_CLASS}
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <MailIcon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('EmailReportNudgeModal.3dc0b0')}
                </h2>
                <p
                    id={DESCRIPTION_ID}
                    className="text-sm leading-relaxed text-secondary-300"
                >
                    {t('EmailReportNudgeModal.8495de', { v0: symbolCount })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href={SETTINGS_HREF}
                    onClick={handleCtaClick}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('EmailReportNudgeModal.8be329')}
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

interface SymbolNudgeModalProps {
    /** 권할 종목(대문자 심볼). */
    symbol: string;
    onClose: () => void;
}

function SymbolNudgeModal({ symbol, onClose }: SymbolNudgeModalProps) {
    const t = useTranslations('features.email-report-nudge');
    const { added, canAdd, isPending, add } = useNudgeWatchlistAdd(symbol);
    const statusRef = useFocusWhenAdded<HTMLParagraphElement>(added);
    useFunnelNudgeShown({ kind: 'member_symbol' });

    return (
        <ModalShell
            titleId={TITLE_ID}
            descriptionId={DESCRIPTION_ID}
            onClose={onClose}
            focusPanel
            className={PANEL_CLASS}
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <PortfolioIcon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('EmailReportNudgeModal.5da22e')}
                </h2>
                <p
                    id={DESCRIPTION_ID}
                    className="text-sm leading-relaxed text-secondary-300"
                >
                    {t('EmailReportNudgeModal.ef5a22', { v0: symbol })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-col">
                    {/* 라이브 영역은 항상 렌더하고 문구만 바꾼다 — 내용과 함께 삽입된 영역은 읽히지 않는 경우가 많다. */}
                    <p
                        ref={statusRef}
                        role="status"
                        aria-live="polite"
                        tabIndex={-1}
                        className={cn(
                            'text-center text-sm font-medium text-primary-300 outline-none',
                            added && 'flex h-10 items-center justify-center'
                        )}
                    >
                        {added ? t('EmailReportNudgeModal.20cd3b') : null}
                    </p>
                    {added ? null : (
                        // 네이티브 disabled는 포커스를 body로 떨어뜨리므로 aria-disabled로 막는다.
                        <button
                            type="button"
                            onClick={add}
                            aria-disabled={!canAdd || isPending}
                            className={cn(
                                BUTTON_PRIMARY,
                                ACTION_SIZE,
                                'aria-disabled:cursor-not-allowed aria-disabled:bg-secondary-700 aria-disabled:text-secondary-500'
                            )}
                        >
                            {t('EmailReportNudgeModal.ad01f2')}
                        </button>
                    )}
                </div>
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
