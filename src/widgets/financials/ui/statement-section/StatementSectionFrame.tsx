/**
 * 재무제표 섹션의 공통 카드 틀 — 제목과 본문을 하나의 landmark로 묶는다.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_CLASS_NAME } from '../../utils/sectionHeading';

interface StatementSectionFrameProps {
    headingId: string;
    title: string;
    children: ReactNode;
}

/** `aria-labelledby`로 제목과 연결된 섹션 카드. */
export function StatementSectionFrame({
    headingId,
    title,
    children,
}: StatementSectionFrameProps) {
    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={headingId} className={HEADING_CLASS_NAME}>
                {title}
            </h2>
            {children}
        </section>
    );
}
