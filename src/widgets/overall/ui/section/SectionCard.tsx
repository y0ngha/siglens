import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

type SectionTone = 'default' | 'focal';

/**
 * 카드 면 스타일. `focal`은 형제 축 요약과 구분되도록 primary 톤의 테두리·배경을 쓴다
 * (통합 결론).
 */
const TONE_CLASS: Record<SectionTone, string> = {
    default: cn(SURFACE_CARD, 'p-6'),
    focal: 'rounded-lg border border-primary-500/30 bg-primary-600/5 p-6',
};

interface SectionCardProps {
    headingId: string;
    title: string;
    tone?: SectionTone;
    /** 제목 아래 간격 클래스. */
    headingGap?: string;
    /**
     * 제목 옆에 붙는 표시. 넘기면 제목이 flex 행에 들어가고, 넘기지 않으면 제목만 단독으로
     * 렌더된다 — 배지가 조건부여도 행 구조가 흔들리지 않게 호출부가 `null`을 넘긴다.
     */
    badge?: ReactNode;
    children: ReactNode;
}

/** 종합 분석 결과 섹션 공용 틀: `aria-labelledby`로 제목과 묶인 카드 + `h2`. */
export function SectionCard({
    headingId,
    title,
    tone = 'default',
    headingGap = 'mb-3',
    badge,
    children,
}: SectionCardProps) {
    const hasBadgeSlot = badge !== undefined;
    const heading = (
        <h2
            id={headingId}
            className={cn(
                HEADING_SECTION,
                !hasBadgeSlot && headingGap,
                'text-balance'
            )}
        >
            {title}
        </h2>
    );

    return (
        <section aria-labelledby={headingId} className={TONE_CLASS[tone]}>
            {hasBadgeSlot ? (
                <div className={cn(headingGap, 'flex items-center gap-2')}>
                    {heading}
                    {badge}
                </div>
            ) : (
                heading
            )}
            {children}
        </section>
    );
}
