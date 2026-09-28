import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

/** `widgets.financials.section` 키 — fundamental·financials 두 위젯의 빈 섹션이 같은 문구를 쓴다. */
const EMPTY_MESSAGE_KEY = 'emptySection';

interface EmptySectionCardProps {
    headingId: string;
    title: string;
    headingClassName: string;
    children?: ReactNode;
}

export function EmptySectionCard({
    headingId,
    title,
    headingClassName,
    children,
}: EmptySectionCardProps) {
    const tSection = useTranslations('widgets.financials.section');
    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={headingId} className={headingClassName}>
                {title}
            </h2>
            <p className="text-sm text-secondary-400">
                {tSection(EMPTY_MESSAGE_KEY)}
            </p>
            {children}
        </section>
    );
}
