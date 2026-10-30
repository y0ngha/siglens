import type { ReactNode } from 'react';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { SectionCard } from '../ui/section/SectionCard';

interface BulletSectionProps {
    headingId: string;
    title: string;
    /** 목록의 접근 가능한 이름(예: "기술적 분석 항목"). */
    listLabel: string;
    bullets: readonly string[];
    /** 제목 옆에 붙는 표시(옵션 섹션의 OI stale 배지). `SectionCard`의 `badge`와 같다. */
    badge?: ReactNode;
}

/**
 * 종합 분석의 bullet 섹션(기술·옵션·펀더멘털·재무·수급·뉴스·리스크) 공용 카드.
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

    return (
        <SectionCard headingId={headingId} title={title} badge={badge}>
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
        </SectionCard>
    );
}
