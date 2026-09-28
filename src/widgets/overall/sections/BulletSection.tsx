import type { ReactNode } from 'react';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface BulletSectionProps {
    headingId: string;
    title: string;
    /** 목록의 접근 가능한 이름(예: "기술적 분석 항목"). */
    listLabel: string;
    bullets: readonly string[];
    /**
     * 제목 옆에 붙는 표시(옵션 섹션의 OI stale 배지). 넘기면 제목이 flex 행에
     * 들어가고, 넘기지 않으면 제목만 단독으로 렌더된다 — 배지가 조건부여도
     * 행 구조가 흔들리지 않게 `null`을 넘긴다.
     */
    badge?: ReactNode;
}

/**
 * 종합 분석의 bullet 섹션(기술·옵션·펀더멘털·재무·뉴스·리스크) 공용 카드.
 * bullet이 비면 섹션째 렌더하지 않는다.
 */
export function BulletSection({
    headingId,
    title,
    listLabel,
    bullets,
    badge,
}: BulletSectionProps) {
    if (bullets.length === 0) return null;

    const hasBadgeSlot = badge !== undefined;
    const heading = (
        <h2
            id={headingId}
            className={cn(
                HEADING_SECTION,
                !hasBadgeSlot && 'mb-3',
                'text-balance'
            )}
        >
            {title}
        </h2>
    );

    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            {hasBadgeSlot ? (
                <div className="mb-3 flex items-center gap-2">
                    {heading}
                    {badge}
                </div>
            ) : (
                heading
            )}
            <ul aria-label={listLabel} className="space-y-2">
                {bullets.map(bullet => (
                    <li key={bullet} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-400"
                        >
                            •
                        </span>
                        <MarkdownText className="min-w-0 text-secondary-400">
                            {bullet}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
