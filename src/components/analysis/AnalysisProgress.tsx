'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * AI 분석이 진행되는 동안 패널 내부에 표시되는 인터랙티브 인디케이터.
 * 사용자가 멈춘 것으로 오해하지 않도록, 단계별 메시지·스피너·스켈레톤·페이즈 도트를 조합하여
 * 분석이 살아 있다는 시각적 신호를 지속적으로 제공한다.
 *
 * 화면 전체를 가리지 않고 AnalysisPanel 내부에서만 동작한다.
 *
 * 분석이 마지막 단계 전에 끝나는 경우(캐시 히트 등)에는 곧바로 사라지지 않고
 * "마무리 애니메이션"으로 전환한다 — 잠시 멈춘 뒤 남은 단계들을 1초 간격으로
 * 빠르게 채워, 사용자가 5단계가 모두 수행되었다고 인지하게 만든다.
 */

const ANALYSIS_PHASES = [
    '시장 데이터 정렬 중',
    '보조지표 시그널 계산 중',
    '캔들 패턴 탐지 중',
    '스킬 매칭 및 신뢰도 평가 중',
    'AI 종합 해석 작성 중',
] as const;

const PHASE_INTERVAL_MS = 20000;
/** 조기 완료 시 마지막 단계로 이동하기 전 잠시 멈추는 시간(ms). */
const FINISHING_HOLD_MS = 3500;
/** 마무리 모드에서 단계를 한 칸씩 진행시키는 간격(ms). */
const FINISHING_STEP_MS = 1000;
/** 마지막 단계에 도달한 뒤 onFinished를 호출하기까지의 여유(ms). */
const FINISHING_TAIL_MS = 600;

interface AnalysisProgressProps {
    /** 부모의 실제 분석 진행 상태. true → 진행 중, false → 응답 도착. */
    isAnalyzing: boolean;
    /** 마무리 애니메이션까지 모두 끝난 시점에 호출된다. */
    onFinished?: () => void;
}

export function AnalysisProgress({
    isAnalyzing,
    onFinished,
}: AnalysisProgressProps) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [finishing, setFinishing] = useState(false);
    const [prevIsAnalyzing, setPrevIsAnalyzing] = useState(isAnalyzing);

    // 항상 최신 onFinished를 호출하기 위한 ref. 마무리 effect 자체는 한 번만 돌아야 하므로
    // onFinished를 deps에 넣지 않고 ref로 우회한다.
    const onFinishedRef = useRef(onFinished);

    // 부모가 isAnalyzing=false로 전환하면 마무리 모드로 진입한다.
    // 한 번 finishing이 true로 가면 다시 false로 돌아가지 않는다 — 마무리는 단조 진행.
    // 렌더 중 setState: effect 없이 prop 변화를 즉시 반영하는 React 공식 파생 상태 패턴.
    if (prevIsAnalyzing !== isAnalyzing) {
        setPrevIsAnalyzing(isAnalyzing);
        if (!isAnalyzing && !finishing) {
            setFinishing(true);
        }
    }

    // 진행 중에는 평소처럼 일정 간격으로 단계 메시지를 순환시킨다.
    // 마무리 모드(finishing)로 들어가면 이 인터벌은 멈추고 별도 effect가 빠른 진행을 담당한다.
    useEffect(() => {
        if (!isAnalyzing || finishing) return;
        const intervalId = window.setInterval(() => {
            setPhaseIndex(prev =>
                prev < ANALYSIS_PHASES.length - 1 ? prev + 1 : prev
            );
        }, PHASE_INTERVAL_MS);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isAnalyzing, finishing]);
    useEffect(() => {
        onFinishedRef.current = onFinished;
    });

    // 마무리 시퀀스: FINISHING_HOLD_MS 만큼 멈췄다가 남은 단계를 1초 간격으로 채운 뒤 종료한다.
    // 이미 마지막 단계에 있었다면 짧은 여운만 두고 곧장 종료한다.
    useEffect(() => {
        if (!finishing) return;
        let cancelled = false;
        const timers: number[] = [];

        const callFinished = () => {
            if (cancelled) return;
            onFinishedRef.current?.();
        };

        const advanceFrom = (current: number) => {
            if (cancelled) return;
            if (current >= ANALYSIS_PHASES.length - 1) {
                timers.push(window.setTimeout(callFinished, FINISHING_TAIL_MS));
                return;
            }
            const next = current + 1;
            setPhaseIndex(next);
            timers.push(
                window.setTimeout(() => advanceFrom(next), FINISHING_STEP_MS)
            );
        };

        // finishing 진입 시점의 phaseIndex를 직접 함수형 setState로 읽어 캡처한다.
        setPhaseIndex(current => {
            if (current >= ANALYSIS_PHASES.length - 1) {
                timers.push(window.setTimeout(callFinished, FINISHING_TAIL_MS));
            } else {
                timers.push(
                    window.setTimeout(
                        () => advanceFrom(current),
                        FINISHING_HOLD_MS
                    )
                );
            }
            return current;
        });

        return () => {
            cancelled = true;
            timers.forEach(id => window.clearTimeout(id));
        };
    }, [finishing]);

    return (
        <div
            className="border-secondary-700/60 bg-secondary-900/40 relative flex flex-col gap-4 overflow-hidden rounded-lg border p-4"
            role="status"
            aria-live="polite"
            aria-label="AI 분석 진행 중"
        >
            {/* 상단의 흐르는 라이트 바: indeterminate progress */}
            <span className="via-primary-500/60 pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent to-transparent" />

            <div className="flex items-center gap-3">
                <Spinner />
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-secondary-200 text-sm font-medium">
                        {ANALYSIS_PHASES[phaseIndex]}
                        <span className="text-primary-400 ml-1 inline-block animate-pulse">
                            …
                        </span>
                    </span>
                    <span className="text-secondary-500 mt-0.5 text-[11px] tracking-wide">
                        분석에는 보통 2분 정도 걸려요. 잠시만 기다려 주세요.
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
