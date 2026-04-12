'use client';

import { cn } from '@/lib/cn';
import {
    ANALYSIS_PHASES,
    ANALYSIS_TIPS,
} from '@/components/symbol-page/hooks/useAnalysisProgress';

/**
 * AI 분석이 진행되는 동안 패널 내부에 표시되는 인터랙티브 인디케이터.
 * 사용자가 멈춘 것으로 오해하지 않도록, 단계별 메시지·스피너·스켈레톤·페이즈 도트를 조합하여
 * 분석이 살아 있다는 시각적 신호를 지속적으로 제공한다.
 *
 * 상태와 타이머 로직은 useAnalysisProgress 훅에서 관리한다.
 * 이 컴포넌트는 phaseIndex와 tipIndex를 props로 받아 렌더링만 담당한다.
 * 덕분에 데스크톱·모바일 두 인스턴스가 항상 동일한 진행 상태를 표시하고,
 * 모바일 시트의 unmount/remount 사이클에서도 상태가 초기화되지 않는다.
 */

interface AnalysisProgressProps {
    phaseIndex: number;
    tipIndex: number;
}

export function AnalysisProgress({ phaseIndex, tipIndex }: AnalysisProgressProps) {
    return (
        <div
            className="border-secondary-700/60 bg-secondary-900/40 relative flex flex-col gap-4 overflow-hidden rounded-lg border p-4"
            role="status"
            aria-live="polite"
            aria-label="AI 분석 진행 중"
        >
            {/* 상단의 흐르는 라이트 바: indeterminate progress */}
            <span className="via-primary-500/60 pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-linear-to-r from-transparent to-transparent" />

            <div className="flex items-center gap-3">
                <Spinner />
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-secondary-200 text-sm font-medium">
                        {ANALYSIS_PHASES[phaseIndex]}
                        <span className="text-primary-400 ml-1 inline-block animate-pulse">
                            …
                        </span>
                    </span>
                    <span
                        key={tipIndex}
                        className="text-secondary-500 mt-0.5 text-[11px] leading-relaxed tracking-wide"
                        style={{ animation: 'fadeIn 0.6s ease-in' }}
                    >
                        {ANALYSIS_TIPS[tipIndex]}
                    </span>
                </div>
            </div>

            {/* 페이즈 도트 — 현재 단계까지를 채운다 */}
            <div className="flex items-center gap-1.5">
                {ANALYSIS_PHASES.map((_, i) => {
                    const isActive = i === phaseIndex;
                    const isDone = i < phaseIndex;
                    return (
                        <span
                            key={i}
                            className={cn(
                                'h-1 flex-1 rounded-full transition-colors duration-500',
                                isDone && 'bg-primary-500/70',
                                isActive && 'bg-primary-400 animate-pulse',
                                !isDone && !isActive && 'bg-secondary-700/70'
                            )}
                        />
                    );
                })}
            </div>

            {/* 스켈레톤 라인 — 텍스트가 곧 채워질 자리임을 암시한다 */}
            <div className="flex flex-col gap-2 pt-1">
                <SkeletonLine widthClass="w-11/12" delayMs={0} />
                <SkeletonLine widthClass="w-10/12" delayMs={150} />
                <SkeletonLine widthClass="w-7/12" delayMs={300} />
            </div>
        </div>
    );
}

function Spinner() {
    return (
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
            <span className="border-secondary-700 border-t-primary-400 absolute inset-0 animate-spin rounded-full border-2" />
            <span className="bg-primary-400/70 h-1 w-1 animate-pulse rounded-full" />
        </span>
    );
}

interface SkeletonLineProps {
    widthClass: string;
    delayMs: number;
}

function SkeletonLine({ widthClass, delayMs }: SkeletonLineProps) {
    return (
        <span
            className={cn(
                'bg-secondary-700/60 block h-2.5 animate-pulse rounded-sm',
                widthClass
            )}
            style={{ animationDelay: `${delayMs}ms` }}
        />
    );
}
