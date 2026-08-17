'use client';

import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';

import { useMacroBriefing } from '../hooks/useMacroBriefing';

const REGIME_LABELS: Record<MacroBriefingResponse['regime'], string> = {
    expansion: '확장',
    slowdown: '둔화',
    contraction: '수축',
    recovery: '회복',
    neutral: '중립',
};

const REGIME_COLORS: Record<MacroBriefingResponse['regime'], string> = {
    expansion: 'bg-ui-success/20 text-ui-success-text',
    slowdown: 'bg-ui-warning/20 text-ui-warning-text',
    contraction: 'bg-ui-danger/20 text-ui-danger-text',
    recovery: 'bg-ui-success/20 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-100',
};

interface MacroBriefingProps {
    peekSeed: MacroBriefingResponse | null;
}

interface MacroBriefingViewProps {
    briefing: MacroBriefingResponse;
    /** null when displaying peekSeed before the real generatedAt is available from the server. */
    generatedAt: string | null;
}

interface MacroBriefingErrorProps {
    onRetry: () => void;
}

/**
 * /economy 상단 거시 AI 브리핑 위젯.
 *
 * 흐름:
 * 1. mount → `useMacroBriefing` — peekSeed가 있으면 그걸 먼저 표시.
 * 2. cached/done이면 briefing 본문 표시. error/봇 차단/미정 시 안내.
 *
 * error는 위젯이 inline notice로 처리한다 — throw로 라우트 단위 boundary에
 * 빠지면 indicator grid·calendar까지 unmount되므로 회피.
 */
export function MacroBriefing({ peekSeed }: MacroBriefingProps) {
    const { input, refetch } = useMacroBriefing(peekSeed);

    if (input === undefined) return <MacroBriefingSkeleton />;
    if (input === null) return <MacroBriefingBotBlocked />;
    if (input === 'error') return <MacroBriefingError onRetry={refetch} />;
    // `cached`와 `done`은 둘 다 briefing 본문을 들고 온다 — 구 구조에서는 `done`이
    // jobId만 주고 별도 폴링 뷰가 결과를 받아왔지만, 이제 한 번의 호출로 완결된다.
    return (
        <MacroBriefingView
            briefing={input.briefing}
            generatedAt={input.generatedAt}
        />
    );
}

function MacroBriefingView({ briefing, generatedAt }: MacroBriefingViewProps) {
    return (
        <section
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
            aria-labelledby="macro-briefing-heading"
        >
            <header className="mb-4 flex items-center gap-3">
                <h2
                    id="macro-briefing-heading"
                    className="text-lg font-semibold text-secondary-100"
                >
                    거시 브리핑
                </h2>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-sm font-medium',
                        REGIME_COLORS[briefing.regime]
                    )}
                >
                    {REGIME_LABELS[briefing.regime]}
                </span>
            </header>
            <p className="mb-4 leading-relaxed whitespace-pre-line text-secondary-200">
                {briefing.summary}
            </p>
            {briefing.highlights.length > 0 && (
                <ul className="space-y-1 text-sm text-secondary-300">
                    {briefing.highlights.map((h, i) => (
                        // briefing 객체가 교체될 때 항목 수가 다르면 index key는
                        // 잘못된 reconciliation을 유발한다 — content+index 결합으로 stable화.
                        <li
                            key={`${h.slice(0, 60)}:${i}`}
                            className="flex gap-2"
                        >
                            <span aria-hidden>•</span>
                            <span>{h}</span>
                        </li>
                    ))}
                </ul>
            )}
            {generatedAt !== null && (
                <p className="mt-3 text-xs text-secondary-400">
                    생성 시각: {formatKoreanDateTime(generatedAt)}
                </p>
            )}
        </section>
    );
}

function MacroBriefingSkeleton() {
    return (
        <section
            className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
            aria-busy="true"
            aria-label="거시 경제 브리핑 로딩 중"
        >
            <div className="mb-3 h-6 w-32 rounded bg-secondary-700" />
            <div className="mb-2 h-4 w-full rounded bg-secondary-700" />
            <div className="h-4 w-4/5 rounded bg-secondary-700" />
        </section>
    );
}

function MacroBriefingBotBlocked() {
    return (
        <section
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6 text-sm text-secondary-300"
            aria-label="거시 경제 브리핑 안내"
        >
            크롤러 접근으로 분석을 생성하지 않았어요.
        </section>
    );
}

function MacroBriefingError({ onRetry }: MacroBriefingErrorProps) {
    return (
        <section
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
            role="alert"
            aria-label="거시 경제 브리핑 안내"
        >
            <p className="text-sm text-secondary-300">
                지금은 거시 브리핑을 만들지 못했어요. 잠시 후 다시 시도해
                주세요.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}
