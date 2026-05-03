import type { OverallAxis } from '@y0ngha/siglens-core';

const AXIS_LABEL: Record<OverallAxis, string> = {
    technical: '기술적 분석',
    fundamental: '펀더멘털 분석',
    news: '뉴스 분석',
};

const AXIS_ORDER: readonly OverallAxis[] = ['technical', 'fundamental', 'news'];

interface DependencyProgressProps {
    pendingJobs: Record<OverallAxis, string | undefined>;
}

/**
 * Displays per-axis dependency resolution progress while waiting for all
 * three axes (technical / fundamental / news) to complete before the overall
 * analysis can be submitted.
 */
export function DependencyProgress({ pendingJobs }: DependencyProgressProps) {
    const completed = AXIS_ORDER.filter(
        axis => pendingJobs[axis] === undefined
    ).length;
    const total = AXIS_ORDER.length;

    return (
        <section
            aria-labelledby="dependency-progress-heading"
            aria-busy="true"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="dependency-progress-heading"
                className="text-lg font-semibold text-balance"
            >
                의존성 분석 진행 중 ({completed}/{total})
            </h2>
            <p
                className="text-secondary-400 mt-1 text-sm"
                aria-live="polite"
                aria-atomic="true"
            >
                3개 축 분석이 완료되면 종합 분석을 생성합니다…
            </p>
            <ul aria-label="축별 진행 상태" className="mt-4 space-y-3">
                {AXIS_ORDER.map(axis => {
                    const isPending = pendingJobs[axis] !== undefined;
                    return (
                        <li key={axis} className="flex items-center gap-3">
                            {isPending ? (
                                <span
                                    aria-hidden="true"
                                    className="border-primary-500 h-4 w-4 shrink-0 animate-pulse rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="text-chart-bullish shrink-0 text-base leading-none"
                                >
                                    ✓
                                </span>
                            )}
                            <span className="text-sm">
                                {AXIS_LABEL[axis]}
                                {isPending ? (
                                    <span className="text-secondary-400">
                                        {' '}
                                        — 진행 중…
                                    </span>
                                ) : (
                                    <span className="text-chart-bullish">
                                        {' '}
                                        — 완료
                                    </span>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
