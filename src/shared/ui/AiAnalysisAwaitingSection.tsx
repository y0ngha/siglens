'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

export interface AiAnalysisAwaitingSectionProps {
    /** 섹션 제목(예: "AI 펀더멘털 분석"). `aria-labelledby`에도 쓰인다. */
    heading: string;
    /** heading id 접두사 — 문서 안에서 유일해야 한다. */
    idPrefix: string;
    /** "AI 분석 시작" — 보통 `useAiAutoRunAllowed().grant`. */
    onStart: () => void;
    className?: string;
}

/**
 * 캐시에 분석이 없고 아직 입력이 없어 생성을 미뤄 둔 상태(`awaiting_interaction`)의 셸.
 *
 * 대부분의 사람은 이 화면을 보지 못한다 — 첫 입력(마우스 이동 포함)이 분석 시작과 거의
 * 같은 순간에 일어나 곧바로 진행 화면으로 넘어간다. 키보드만 쓰거나 아무것도 건드리지
 * 않은 채 읽는 사람을 위해 버튼을 둔다. 문구는 기다리게 한 이유를 설명하지 않는다
 * (게이트는 내부 비용 장치라 사용자에게 의미가 없다) — 다음 행동만 알려 준다.
 */
export function AiAnalysisAwaitingSection({
    heading,
    idPrefix,
    onStart,
    className,
}: AiAnalysisAwaitingSectionProps) {
    const t = useTranslations('shared.ui');
    const headingId = `${idPrefix}-awaiting-heading`;

    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'p-6', className)}
        >
            <h2
                id={headingId}
                className={cn('mb-2 text-balance', HEADING_SECTION)}
            >
                {heading}
            </h2>
            <p className="text-sm text-secondary-400">
                {t('AiAnalysisAwaitingSection.3e7fd8')}
            </p>
            <button
                type="button"
                onClick={onStart}
                className="mt-4 inline-flex min-h-11 touch-manipulation items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('AiAnalysisAwaitingSection.05d860')}
            </button>
        </section>
    );
}
