'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import {
    useReportSymbolToggle,
    type ReportSymbolToggleMode,
} from '../hooks/useReportSymbolToggle';

interface ReportSymbolChipProps {
    symbol: string;
    /** 보유·관심종목 행의 표시명. 없으면 심볼만 보인다. */
    name: string | null;
    /** `exclude`: 리포트에 담긴 칩(✕로 빼기). `include`: 뺀 칩(다시 넣기). */
    mode: ReportSymbolToggleMode;
}

const CHIP =
    'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-control bg-secondary-900/60 py-0.5 pr-1 pl-3 text-sm text-secondary-100';
const BUTTON =
    'inline-flex shrink-0 touch-manipulation items-center justify-center rounded-full text-secondary-300 transition-colors hover:bg-secondary-700/40 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-secondary-500';

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
    const { pending, toggle } = useReportSymbolToggle(symbol, mode);
    const display = name ?? symbol;

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
            {mode === 'exclude' ? (
                <button
                    type="button"
                    onClick={toggle}
                    disabled={pending}
                    aria-label={t('ReportSymbolChip.exclude', { v0: display })}
                    className={cn(BUTTON, 'size-7')}
                >
                    <CloseIcon className="size-4" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={toggle}
                    disabled={pending}
                    aria-label={t('ReportSymbolChip.includeLabel', {
                        v0: display,
                    })}
                    className={cn(BUTTON, 'min-h-7 px-2.5 text-xs font-medium')}
                >
                    {t('ReportSymbolChip.include')}
                </button>
            )}
        </li>
    );
}
