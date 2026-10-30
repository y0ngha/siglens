import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { CASE_CARD_VARIANT } from '../../utils/caseCardVariants';

interface ReturnSummaryProps {
    case_: BacktestCase;
    /** 이미 포맷된 수익률 문자열(`+5.3%`). 카드의 aria-label과 같은 값을 쓴다. */
    returnLabel: string;
}

/** 수익률과 수익/손실 표식. 색만으로 구분하지 않도록 스크린리더용 텍스트를 함께 둔다. */
export function ReturnSummary({ case_: c, returnLabel }: ReturnSummaryProps) {
    const t = useTranslations('widgets.backtesting');
    const isWin = c.result === 'win';
    const { returnText } = CASE_CARD_VARIANT[c.result];
    return (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
                className={cn(
                    'font-mono text-sm font-bold tabular-nums',
                    returnText
                )}
            >
                {returnLabel}
            </span>
            <span aria-hidden="true" className={cn('text-xs', returnText)}>
                {isWin ? '✓' : '✗'}
            </span>
            <span className="sr-only">
                {isWin
                    ? t('BacktestCaseCard.bd6b14')
                    : t('BacktestCaseCard.b19f09')}
            </span>
        </div>
    );
}
