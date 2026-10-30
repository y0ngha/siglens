'use client';

import { cn } from '@/shared/lib/cn';
import {
    groupLines,
    sliceSegments,
    type LineReveal,
    type ReplayLine,
    type ReplayTool,
    type Segment,
} from '@/shared/lib/replay/replayScript';

/*
 * `/about` 리플레이 두 벌(ai.siglens.io의 `ChatReplay`, siglens.io의 `ReportReplay`)이
 * `Frame` 안에 그리는 표현 조각. 두 리플레이는 크롬(채팅 말풍선 vs 주소창)만 다르므로
 * 단계·스트리밍 본문·출처 줄을 여기 한 곳에 둔다.
 */

const TONE_CLASS: Readonly<Record<Segment['tone'], string | null>> = {
    plain: null,
    strong: 'font-semibold text-secondary-50 tabular-nums',
    up: 'font-semibold text-ui-success-text tabular-nums',
    down: 'font-semibold text-ui-danger-text tabular-nums',
};

interface SegmentsProps {
    readonly segments: readonly Segment[];
}

function Segments({ segments }: SegmentsProps) {
    return segments.map((segment, i) => {
        const cls = TONE_CLASS[segment.tone];
        return cls === null ? (
            segment.text
        ) : (
            <strong key={i} className={cls}>
                {segment.text}
            </strong>
        );
    });
}

/** 스트리밍 중인 줄 끝의 깜빡이는 캐럿. 장식이라 보조기술에서 숨긴다. */
export const ReplayCaret = () => (
    <span
        aria-hidden="true"
        className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-secondary-300 motion-safe:animate-pulse"
    />
);

interface ReplayStepsProps {
    readonly tools: readonly ReplayTool[];
    /** `tools` 중 끝난 단계의 수. */
    readonly done: number;
}

/** 조회·단계가 하나씩 켜지는 줄: 진행 중이면 맥동하고, 끝나면 초록으로 바뀐다. */
export function ReplaySteps({ tools, done }: ReplayStepsProps) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool, t) => {
                const finished = t < done;
                return (
                    <li
                        key={tool.label}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs',
                            finished
                                ? 'border-secondary-700 text-secondary-400'
                                : 'border-border-control text-secondary-200'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1.5 rounded-full',
                                finished
                                    ? 'bg-ui-success'
                                    : 'bg-secondary-300 motion-safe:animate-pulse'
                            )}
                        />
                        {finished ? tool.label : tool.pendingLabel}
                        <span className="text-secondary-400 tabular-nums">
                            {tool.subject}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

interface ReplayLinesProps {
    readonly lines: readonly ReplayLine[];
    readonly reveal: readonly LineReveal[];
}

/** 스트리밍 본문: 문단과 불릿 묶음을 각각 공개된 글자 수까지만 그린다. */
export function ReplayLines({ lines, reveal }: ReplayLinesProps) {
    return (
        <div className="flex flex-col gap-2">
            {groupLines(lines).map(group => {
                const visible = group.items.flatMap(({ line, index }) => {
                    const state = reveal[index];
                    return state !== undefined && state.shown > 0
                        ? [{ line, index, state }]
                        : [];
                });
                const [first] = visible;
                if (first === undefined) return null;
                const rendered = visible.map(({ line, index, state }) => {
                    const body = (
                        <>
                            <Segments
                                segments={sliceSegments(
                                    line.segments,
                                    state.shown
                                )}
                            />
                            {state.caret ? <ReplayCaret /> : null}
                        </>
                    );
                    return group.kind === 'li' ? (
                        <li key={index}>{body}</li>
                    ) : (
                        <p key={index}>{body}</p>
                    );
                });
                const key = first.index;
                return group.kind === 'li' ? (
                    <ul
                        key={key}
                        className="flex list-disc flex-col gap-1 pl-5 marker:text-secondary-400"
                    >
                        {rendered}
                    </ul>
                ) : (
                    <div key={key} className="flex flex-col gap-2">
                        {rendered}
                    </div>
                );
            })}
        </div>
    );
}

interface ReplaySourcesProps {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
    /**
     * 기준 시각 앞의 `·` 구분자. 광고 랜딩(`/lp`)은 카피 규칙이 `·`를 금지해서
     * 끈다(spec `2026-09-26-ad-landing-pages-design.md`).
     */
    readonly separator?: boolean;
}

/** 출처 칩과 기준 시각을 한 줄로 보여주는 푸터. */
export function ReplaySources({
    label,
    sources,
    asOf,
    separator = true,
}: ReplaySourcesProps) {
    return (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-secondary-700 pt-2.5 text-xs text-secondary-400">
            {label}
            {sources.map(source => (
                <span
                    key={source}
                    className="rounded bg-secondary-700/40 px-2 py-0.5 font-medium text-secondary-300"
                >
                    {source}
                </span>
            ))}
            <span className="tabular-nums">
                {separator ? (
                    <>
                        <span aria-hidden="true">|</span> {asOf}
                    </>
                ) : (
                    asOf
                )}
            </span>
        </p>
    );
}

interface ReplayPauseButtonProps {
    readonly paused: boolean;
    readonly onToggle: () => void;
    readonly pauseLabel: string;
    readonly resumeLabel: string;
}

/**
 * 리플레이 일시정지/재생 버튼. 글자가 지금 누르면 일어날 동작을 말하므로 `aria-pressed`를
 * 달지 않는다 — 이름이 바뀌는 버튼에 함께 달면 상태가 뒤집혀 두 번 읽힌다.
 */
export function ReplayPauseButton({
    paused,
    onToggle,
    pauseLabel,
    resumeLabel,
}: ReplayPauseButtonProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="inline-flex min-h-8 items-center rounded-lg border border-border-control px-2.5 text-xs text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {paused ? resumeLabel : pauseLabel}
        </button>
    );
}
