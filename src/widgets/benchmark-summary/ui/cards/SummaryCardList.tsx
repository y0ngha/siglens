/** 요약 카드를 담는 그리드 목록. */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { summaryGridColumnsClass } from '../../utils/summaryGridColumns';

interface Props {
    /** 목록 안 카드 수. 넓은 화면의 열 수를 정한다. */
    readonly cardCount: number;
    readonly children: ReactNode;
}

/** 카드 그리드(`ul`). 열 수는 카드 수에서 정한다. */
export function SummaryCardList({ cardCount, children }: Props) {
    return (
        <ul
            className={cn(
                'mt-7 grid gap-3 sm:grid-cols-2',
                summaryGridColumnsClass(cardCount)
            )}
        >
            {children}
        </ul>
    );
}
