'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import {
    useReportSymbolToggle,
    type ReportSymbolToggleMode,
} from '../hooks/useReportSymbolToggle';

interface ReportSymbolChipProps {
    /** 액션에 넘기는 종목 심볼. 이름이 있으면 그 옆에 작게 보인다. */
    symbol: string;
    /** 보유·관심종목 행의 표시명. 없으면 심볼만 보인다. */
    name: string | null;
    /**
     * `exclude`: 리포트에 담긴 칩(✕로 빼기). `include`: 뺀 칩(다시 넣기). `clear`: 목록에서 이미
     * 지운 종목의 제외 기록 칩(기록 지우기).
     */
    mode: ReportSymbolToggleMode;
}

const CHIP =
    'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-control bg-secondary-900/60 py-0.5 pr-1 pl-3 text-sm text-secondary-100';
const TEXT_BUTTON = 'min-h-7 px-2.5 text-xs font-medium';
const BUTTON =
    'inline-flex shrink-0 touch-manipulation items-center justify-center rounded-full text-secondary-300 transition-colors hover:bg-secondary-700/40 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:text-secondary-500';

interface ChipButtonContent {
    readonly ariaLabel: string;
    readonly content: ReactNode;
    readonly className: string;
}

/**
 * 미리보기 칩 한 개. 칩 자체는 서버가 계산한 값이고, 버튼만 상호작용이다 — 누르면 액션을 부르고
 * 서버 컴포넌트를 새로고침한다(`useReportSymbolToggle`). 버튼은 28px 이상 히트 영역을 갖는다.
 */
export function ReportSymbolChip({
    symbol,
    name,
    mode,
}: ReportSymbolChipProps) {
    const t = useTranslations('features.email-report-settings');
    const display = name ?? symbol;
    const { pending, toggle } = useReportSymbolToggle(symbol, mode, display);
    // 담긴 칩은 ✕ 아이콘, 뺀 칩·지운 기록 칩은 글자 버튼이다. 접근 이름에는 종목을 넣는다.
    const buttonByMode: Record<
        ReportSymbolToggleMode,
        () => ChipButtonContent
    > = {
        exclude: () => ({
            ariaLabel: t('ReportSymbolChip.exclude', { v0: display }),
            content: <CloseIcon className="size-4" />,
            className: 'size-7',
        }),
        include: () => ({
            ariaLabel: t('ReportSymbolChip.includeLabel', { v0: display }),
            content: t('ReportSymbolChip.include'),
            className: TEXT_BUTTON,
        }),
        clear: () => ({
            ariaLabel: t('ReportSymbolChip.clearLabel', { v0: display }),
            content: t('ReportSymbolChip.clear'),
            className: TEXT_BUTTON,
        }),
    };
    const button = buttonByMode[mode]();

    return (
        <li className={CHIP}>
            {name !== null ? (
                <>
                    <span className="truncate">{name}</span>
                    <span className="text-xs text-secondary-400 tabular-nums">
                        {symbol}
                    </span>
                </>
            ) : (
                <span>{symbol}</span>
            )}
            <button
                type="button"
                onClick={toggle}
                aria-disabled={pending || undefined}
                aria-label={button.ariaLabel}
                className={cn(BUTTON, button.className)}
            >
                {button.content}
            </button>
        </li>
    );
}
