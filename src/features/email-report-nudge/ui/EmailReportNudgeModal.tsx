'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import { cn } from '@/shared/lib/cn';
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

function SetupNudgeModal({
    symbolCount,
    onClose,
}: {
    symbolCount: number;
    onClose: () => void;
}) {
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
            onClose={onClose}
            focusPanel
            className={PANEL_CLASS}
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <MailIcon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('EmailReportNudgeModal.3dc0b0')}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
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

function SymbolNudgeModal({
    symbol,
    onClose,
}: {
    symbol: string;
    onClose: () => void;
}) {
    const t = useTranslations('features.email-report-nudge');
    const watchlist = useWatchlist();
    const [isPending, setIsPending] = useState(false);
    const pendingRef = useRef(false);
    const statusRef = useRef<HTMLParagraphElement>(null);
    useFunnelNudgeShown({ kind: 'member_symbol' });

    // "담았어요"는 실제로 담긴 상태(`has`, 낙관적 갱신·실패 시 롤백)만 따른다. 한도 초과·실패는
    // 훅이 토스트로 알리고 버튼은 그대로 남아, 담기지 않았는데 담겼다고 보이는 일이 없다.
    const added = watchlist.has(symbol);
    const canToggle = watchlist.isHydrated && !watchlist.isIdentityPending;

    // 담기 성공으로 버튼이 사라지면 포커스가 body로 떨어져 Tab이 모달 밖으로 새므로,
    // 담김 상태로 바뀌는 순간 상태 문구로 포커스를 옮긴다(열릴 때 이미 담겨 있으면 건드리지 않는다).
    const wasAddedRef = useRef(added);
    useEffect(() => {
        if (added && !wasAddedRef.current) statusRef.current?.focus();
        wasAddedRef.current = added;
    }, [added]);

    const addToWatchlist = async (): Promise<void> => {
        if (!canToggle || pendingRef.current) return;
        pendingRef.current = true;
        trackFunnelEvent('nudge_clicked', {
            kind: 'member_symbol',
            cta: 'add',
        });
        setIsPending(true);
        // 라벨은 심볼로 넘긴다: 회원 경로의 `addWatchlistItemAction`이 회사명을 채운다.
        // `try … finally`는 React Compiler가 내리지 못해(react-hooks-js/todo) `.catch`로 대신한다 —
        // add는 실패를 결과값('failed')으로 돌려주지만, 혹시 던져도 진행 상태는 반드시 푼다.
        await watchlist
            .add({ symbol, label: symbol }, 'nudge')
            .catch(() => 'failed' as const);
        pendingRef.current = false;
        setIsPending(false);
    };

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className={PANEL_CLASS}
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <PortfolioIcon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('EmailReportNudgeModal.5da22e')}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
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
                            onClick={addToWatchlist}
                            aria-disabled={!canToggle || isPending}
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
