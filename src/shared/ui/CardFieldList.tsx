/**
 * 카드 안의 "라벨 — 값" 정의 목록.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/** 카드 필드 하나 — 날짜처럼 ASCII 값은 `mono`로 고정폭을 쓴다. */
export interface CardField {
    readonly label: string;
    readonly value: ReactNode;
    readonly mono?: boolean;
}

/** 두 칸 격자로 라벨(왼쪽)과 값(오른쪽 정렬)을 늘어놓는다. 한 카드 안에서 라벨은 겹치지 않는다. */
export function CardFieldList({
    fields,
}: {
    readonly fields: readonly CardField[];
}) {
    return (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {fields.map(({ label, value, mono = false }) => (
                <div key={label} className="contents">
                    <dt className="text-secondary-400">{label}</dt>
                    <dd
                        className={cn(
                            'text-right text-secondary-200 tabular-nums',
                            mono && 'font-mono'
                        )}
                    >
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
