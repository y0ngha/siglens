/**
 * 기준 시점 목록의 한 줄 — 왼쪽 용어, 오른쪽 값.
 */
import type { ReactNode } from 'react';

/** 기준 시점 한 줄(용어 + 값). */
export function AsOfRow({
    term,
    children,
}: {
    readonly term: string;
    readonly children: ReactNode;
}) {
    return (
        <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
            <dt className="text-xs text-secondary-400">{term}</dt>
            <dd className="text-sm text-secondary-200">{children}</dd>
        </div>
    );
}
