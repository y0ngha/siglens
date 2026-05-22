import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/domain/constants/time';
import { AUGMENT_AND_OVERALL_POLL_INTERVAL_MS } from '@/lib/pollingConfig';
import type { OverallAxis } from '@y0ngha/siglens-core';

const AXIS_LABEL: Record<OverallAxis, string> = {
    technical: '기술적 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    options: '옵션 시장 분석',
};

const AXIS_ORDER: readonly OverallAxis[] = [
    'technical',
    'fundamental',
    'news',
    'options',
];

/**
 * 각 축의 평균 처리 소요 시간 (초 단위).
 * 기술적 분석은 다단계 지표 계산으로 약 5분, 나머지는 약 1분.
 * 옵션 분석은 단일 만기 contract 묶음만 LLM에 보내므로 뉴스/펀더멘털과
 * 비슷한 1분으로 가정한다.
 */
const AXIS_ESTIMATED_SECONDS: Record<OverallAxis, number> = {
    technical: 5 * SECONDS_PER_MINUTE,
    news: SECONDS_PER_MINUTE,
    fundamental: SECONDS_PER_MINUTE,
    options: SECONDS_PER_MINUTE,
};

interface DependencyProgressProps {
    pendingJobs: Record<OverallAxis, string | undefined>;
    retryCount: number;
}

export function DependencyProgress({
    pendingJobs,
    retryCount,
}: DependencyProgressProps) {
    const completed = AXIS_ORDER.filter(
        axis => pendingJobs[axis] === undefined
    ).length;
    const total = AXIS_ORDER.length;

    const pendingAxes = AXIS_ORDER.filter(
        axis => pendingJobs[axis] !== undefined
    );
    const estimatedTotalSeconds = pendingAxes.reduce(
        (sum, axis) => sum + AXIS_ESTIMATED_SECONDS[axis],
        0
    );
    const elapsedSeconds = Math.round(
        (retryCount * AUGMENT_AND_OVERALL_POLL_INTERVAL_MS) / MS_PER_SECOND
    );
    const remainingSeconds = Math.max(
        0,
        estimatedTotalSeconds - elapsedSeconds
    );
    const remainingMinutes = Math.max(
        1,
        Math.ceil(remainingSeconds / SECONDS_PER_MINUTE)
    );

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
                종합 분석에 필요한 데이터 수집 중 ({completed}/{total})
            </h2>
            <p className="text-secondary-400 mt-1 text-sm">
                {total}개 축 분석이 완료되면 종합 분석을 생성합니다…
            </p>
            <p
                className="text-secondary-400 mt-1 text-sm"
                aria-live="polite"
                aria-atomic="true"
            >
                약 {remainingMinutes}분 소요 예정이지만, AI 분석 모델에 따라
                달라질 수 있어요.
            </p>
            <ul aria-label="축별 진행 상태" className="mt-4 space-y-3">
                {AXIS_ORDER.map(axis => {
                    const isPending = pendingJobs[axis] !== undefined;
                    return (
                        <li key={axis} className="flex items-center gap-3">
                            {isPending ? (
                                <span
                                    aria-hidden="true"
                                    className="border-primary-500 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
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
