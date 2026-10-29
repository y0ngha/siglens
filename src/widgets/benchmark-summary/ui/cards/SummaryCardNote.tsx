/** 카드 숫자 아래의 작은 설명 줄. */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface Props {
    /** 숫자가 섞인 줄이면 자릿수가 흔들리지 않게 고정폭 숫자를 쓴다. */
    readonly numeric?: boolean;
    readonly children: ReactNode;
}

/** 설명 줄 하나(`p`). */
export function SummaryCardNote({ numeric = false, children }: Props) {
    return (
        <p
            className={cn(
                'mt-1 text-xs leading-5 text-secondary-300',
                numeric && 'tabular-nums'
            )}
        >
            {children}
        </p>
    );
}
