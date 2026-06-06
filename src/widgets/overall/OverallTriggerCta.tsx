'use client';

import { cn } from '@/shared/lib/cn';

interface OverallTriggerCtaProps {
    onTrigger: () => void;
    /**
     * `true`면 버튼 비활성. 보통 개별 뉴스 카드 분석이 진행 중이라 종합 분석이
     * 새 뉴스 누락 부분 결과로 진행되는 걸 막을 때 사용한다(/news와 동일 게이트).
     */
    disabled?: boolean;
}

export function OverallTriggerCta({
    onTrigger,
    disabled = false,
}: OverallTriggerCtaProps) {
    return (
        <section
            aria-labelledby="overall-cta-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-12 text-center"
        >
            <h2
                id="overall-cta-heading"
                className="text-2xl font-semibold text-balance"
            >
                AI 종합 분석
            </h2>
            <p className="text-secondary-400 mt-3 text-sm leading-relaxed">
                차트·옵션·펀더멘털·뉴스·시장 분위기를 통합한 AI 결론을
                받아보세요.
            </p>
            <button
                type="button"
                onClick={onTrigger}
                disabled={disabled}
                className={cn(
                    'mt-6 inline-flex items-center rounded-md px-6 py-3 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    disabled
                        ? 'bg-secondary-600 cursor-not-allowed opacity-60'
                        : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500'
                )}
            >
                {disabled ? '뉴스 카드 분석 중…' : 'AI 종합 분석 받기'}
            </button>
            {disabled && (
                <p
                    className="text-secondary-500 mt-3 text-xs"
                    aria-live="polite"
                >
                    개별 뉴스 분석이 완료되면 종합 분석을 받을 수 있어요.
                </p>
            )}
        </section>
    );
}
