'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { LocaleLink } from './LocaleLink';

interface PlainAnalysisViewProps {
    /** 평이화 산문. 문단은 빈 줄로 구분된다. */
    text: string;
    /**
     * 티어 게이트로 가려진 정보가 있는지. 비어 있지 않으면 하단에 잠금 안내를 붙인다.
     *
     * 원본 뷰는 필드별 잠금 카드로 이걸 표현하지만 쉽게보기에는 카드가 없다.
     * 안내를 빠뜨리면 무료 사용자는 산문이 원본보다 부실하다고만 느끼고, 잠긴 항목이
     * 있다는 사실 자체를 알 수 없다.
     */
    hasLockedDetails: boolean;
    /** 원본보기로 전환. pill과 같은 전역 상태를 바꾼다. */
    onShowRaw: () => void;
    className?: string;
}

/**
 * 평이화된 분석문을 문단으로 렌더한다.
 *
 * 마크다운을 파싱하지 않는다 — 프롬프트가 마크다운을 금지하고, 가드를 통과한
 * 산출물은 평문 문단이다. 렌더러를 끼우면 모델이 실수로 흘린 `**`가 굵게 표시되어
 * 오히려 규칙 위반을 감춘다.
 */
export function PlainAnalysisView({
    text,
    hasLockedDetails,
    onShowRaw,
    className,
}: PlainAnalysisViewProps) {
    const t = useTranslations('widgets.analysis.viewToggle');
    const paragraphs = text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (paragraphs.length === 0) return null;

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-col gap-3">
                {paragraphs.map((paragraph, index) => (
                    <p
                        key={index}
                        className="text-sm leading-7 text-secondary-200"
                    >
                        {paragraph}
                    </p>
                ))}
            </div>

            {hasLockedDetails && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-control bg-secondary-900/50 px-3 py-2">
                    <p className="text-xs text-secondary-400">
                        {t('lockedNotice')}
                    </p>
                    {/*
                     * 기본값이 쉽게보기라 무료 사용자 대부분이 이 화면에 먼저 닿는다.
                     * 원본 뷰의 가입 유도 카드가 여기엔 없으므로, 안내만 남기면
                     * 전환 경로가 "원본으로 전환" 한 단계 뒤로 밀린다(리뷰 라운드 1
                     * 권고). 링크를 같은 줄에 둔다.
                     */}
                    <LocaleLink
                        href="/signup"
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('lockedCta')}
                    </LocaleLink>
                </div>
            )}

            <button
                type="button"
                onClick={onShowRaw}
                className={cn(
                    'border-border-control text-secondary-300 hover:border-primary-500 hover:text-secondary-100',
                    'focus-visible:ring-primary-500 min-h-11 cursor-pointer touch-manipulation self-start rounded border px-3 py-2 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none'
                )}
            >
                {t('cta')}
            </button>
        </div>
    );
}
