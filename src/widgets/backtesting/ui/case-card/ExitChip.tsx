import { useTranslations } from 'next-intl';
import type { BacktestCase, BacktestExitReason } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatUsdCurrency } from '@/shared/lib/priceFormat';

interface ExitChipProps {
    case_: BacktestCase;
}

interface ExitTone {
    chip: string;
    label: string;
}

const DANGER_TONE: ExitTone = {
    chip: 'border-chart-bearish/20 bg-chart-bearish/10',
    label: 'text-ui-danger-text',
};
const NEUTRAL_TONE: ExitTone = {
    chip: 'border-secondary-700 bg-secondary-800',
    label: 'text-secondary-200',
};

/**
 * 청산 사유 → `shared.enumLabel.backtestExitReason` 키와 배색.
 *
 * 손절만 danger 배색이다. 수익 케이스가 "초록 진입 → 빨강 청산"으로 읽히면 승률이라는
 * 이 페이지의 논지와 배색이 반대를 말하게 된다.
 */
const EXIT_REASON: Record<
    BacktestExitReason,
    { labelKey: `backtestExitReason.${BacktestExitReason}`; tone: ExitTone }
> = {
    stop_loss: {
        labelKey: 'backtestExitReason.stop_loss',
        tone: DANGER_TONE,
    },
    take_profit: {
        labelKey: 'backtestExitReason.take_profit',
        tone: NEUTRAL_TONE,
    },
    time: { labelKey: 'backtestExitReason.time', tone: NEUTRAL_TONE },
};

/** 청산 칩(청산 사유·청산일·청산가). */
export function ExitChip({ case_: c }: ExitChipProps) {
    // 번역자 호출에 조회 결과를 직접 넘겨야 추출기가 `shared.enumLabel`을 클라이언트
    // 번들에 싣는다(RiskBadge와 같은 이유).
    const tLabel = useTranslations('shared.enumLabel');
    const { labelKey, tone } = EXIT_REASON[c.exitReason];
    return (
        <div
            className={cn(
                'shrink-0 rounded border px-2 py-1 text-right',
                tone.chip
            )}
        >
            <span className={cn('font-semibold', tone.label)}>
                {tLabel(labelKey)}
            </span>
            <span className="ml-1 text-secondary-400">{c.exitDate}</span>
            <span className="ml-1 font-mono text-secondary-500 tabular-nums">
                {formatUsdCurrency(c.exitPrice)}
            </span>
        </div>
    );
}
