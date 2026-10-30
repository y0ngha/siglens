/** 요약 카드 한 장의 틀: 라벨, 큰 숫자, 아래 설명 줄. */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface Props {
    /** 숫자가 무엇인지 말하는 라벨. */
    readonly label: string;
    /** 서식을 입힌 대표 숫자. */
    readonly value: string;
    /** 숫자 아래 설명 줄(`SummaryCardNote`). */
    readonly children: ReactNode;
}

/** 목록 항목(`li`) 하나로 그리는 카드. */
export function SummaryCard({ label, value, children }: Props) {
    return (
        <li className={cn(SURFACE_CARD, 'p-4')}>
            <p className="text-xs text-secondary-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-secondary-50 tabular-nums">
                {value}
            </p>
            {children}
        </li>
    );
}
