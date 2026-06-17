'use client';

import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';

import { useMacroBriefing } from '../hooks/useMacroBriefing';
import { useMacroBriefingPoll } from '../hooks/useMacroBriefingPoll';

const REGIME_LABELS: Record<MacroBriefingResponse['regime'], string> = {
    expansion: '확장',
    slowdown: '둔화',
    contraction: '수축',
    recovery: '회복',
    neutral: '중립',
};

const REGIME_COLORS: Record<MacroBriefingResponse['regime'], string> = {
    expansion: 'bg-ui-success/20 text-ui-success',
    slowdown: 'bg-ui-warning/20 text-ui-warning',
    contraction: 'bg-ui-danger/20 text-ui-danger',
    recovery: 'bg-ui-success/20 text-ui-success',
    neutral: 'bg-secondary-700 text-secondary-100',
};

interface MacroBriefingProps {
    peekSeed: MacroBriefingResponse | null;
}

interface MacroBriefingPollingViewProps {
    jobId: string;
}

interface MacroBriefingViewProps {
    briefing: MacroBriefingResponse;
    generatedAt: string;
}

/**
 * /economy 상단 거시 AI 브리핑 위젯.
 *
 * 흐름:
 * 1. mount → submit action(`useMacroBriefing`) — peekSeed가 있으면 그걸 먼저 표시.
 * 2. submitted면 jobId로 polling(`useMacroBriefingPoll`) → done까지 5s 간격.
 * 3. cached/done이면 briefing 본문 표시. error/봇 차단/미정 시 안내.
 *
 * 폴링 error는 위젯이 inline notice로 처리한다 — throw로 라우트 단위 boundary에
 * 빠지면 indicator grid·calendar까지 unmount되므로 회피.
 */
export function MacroBriefing({ peekSeed }: MacroBriefingProps) {
    const { input } = useMacroBriefing(peekSeed);

    if (input === undefined) return <MacroBriefingSkeleton />;
    if (input === null) return <MacroBriefingBotBlocked />;
    if (input === 'error') return <MacroBriefingError />;
    if (input.status === 'cached') {
        return (
            <MacroBriefingView
                briefing={input.briefing}
                generatedAt={input.generatedAt}
            />
        );
    }
    return <MacroBriefingPollingView jobId={input.jobId} />;
}

function MacroBriefingPollingView({ jobId }: MacroBriefingPollingViewProps) {
    const poll = useMacroBriefingPoll(jobId);
    if (poll.status === 'processing') return <MacroBriefingSkeleton />;
    if (poll.status === 'error') return <MacroBriefingError />;
    return (
        <MacroBriefingView
            briefing={poll.briefing}
            generatedAt={poll.generatedAt}
        />
    );
}

function MacroBriefingView({ briefing, generatedAt }: MacroBriefingViewProps) {
    return (
        <section
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            aria-labelledby="macro-briefing-heading"
        >
            <header className="mb-4 flex items-center gap-3">
                <h2
                    id="macro-briefing-heading"
                    className="text-secondary-100 text-xl font-semibold"
                >
                    거시 브리핑
                </h2>
                <span
                    className={cn(
                        'rounded-full px-3 py-0.5 text-sm font-medium',
                        REGIME_COLORS[briefing.regime]
                    )}
                >
                    {REGIME_LABELS[briefing.regime]}
                </span>
            </header>
            <p className="text-secondary-200 mb-4 leading-relaxed whitespace-pre-line">
                {briefing.summary}
            </p>
            {briefing.highlights.length > 0 && (
                <ul className="text-secondary-300 space-y-1 text-sm">
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
            {generatedAt && (
                <p className="text-secondary-500 mt-3 text-xs">
                    생성 시각: {new Date(generatedAt).toLocaleString('ko-KR')}
                </p>
            )}
        </section>
    );
}

function MacroBriefingSkeleton() {
    return (
        <section
            className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-6"
            aria-busy="true"
            aria-label="거시 경제 브리핑 로딩 중"
        >
            <div className="bg-secondary-700 mb-3 h-6 w-32 rounded" />
            <div className="bg-secondary-700 mb-2 h-4 w-full rounded" />
            <div className="bg-secondary-700 h-4 w-4/5 rounded" />
        </section>
    );
}

function MacroBriefingBotBlocked() {
    return (
        <section
            className="border-secondary-700 bg-secondary-800 text-secondary-300 rounded-xl border p-6 text-sm"
            aria-label="거시 경제 브리핑 안내"
        >
            크롤러 접근으로 분석을 생성하지 않았어요.
        </section>
    );
}

function MacroBriefingError() {
    return (
        <section
            className="border-secondary-700 bg-secondary-800 text-secondary-300 rounded-xl border p-6 text-sm"
            role="alert"
            aria-label="거시 경제 브리핑 안내"
        >
            지금은 거시 브리핑을 만들지 못했어요. 잠시 후 다시 시도해 주세요.
        </section>
    );
}
