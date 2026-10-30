'use client';

/**
 * 날짜 묶음(오늘·어제·이번 주·이전) 하나 — 제목과 그 아래 대화 행 목록.
 */
import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { LABEL_KO } from '@/shared/lib/typographyStyles';

interface ConversationGroupProps {
    readonly label: string;
    readonly children: ReactNode;
}

/**
 * 묶음 제목 id는 `useId`로 만든다 — 같은 레일이 `lg` 미만에서 숨긴 `aside`와 서랍에 두 번
 * 마운트돼, 고정 id면 DOM에 중복 id가 생기고 `aria-labelledby`가 숨은 쪽 제목을 가리킨다.
 */
export function ConversationGroup({ label, children }: ConversationGroupProps) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId}>
            <p id={headingId} className={cn(LABEL_KO, 'px-2 pt-4 pb-1')}>
                {label}
            </p>
            <ul className="space-y-0.5">{children}</ul>
        </section>
    );
}
