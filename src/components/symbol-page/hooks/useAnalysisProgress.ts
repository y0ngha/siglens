'use client';

import { useEffect, useRef, useState } from 'react';
import { MS_PER_MINUTE } from '@/domain/constants/time';

export const ANALYSIS_PHASES = [
    '시장 데이터 정렬 중',
    '20개 이상의 보조지표 시그널 분석 중',
    '캔들 패턴 및 차트 패턴 탐지 중',
    '60개 이상의 스킬을 조합하여 시그널 매칭 중',
    '매수·매도 전략 및 리스크 평가 중',
    'AI 종합 해석 작성 중',
] as const;

const PHASE_INTERVAL_MS = MS_PER_MINUTE;

export const ANALYSIS_TIPS = [
    '20개 이상의 보조지표와 60개 이상의 스킬을 조합해 분석합니다.',
    'AI 분석은 보통 5분정도 소요돼요. 최대 15분까지 소요될 수 있어요.',
    '화면을 띄워 놓고 다른 작업을 하셔도 됩니다. 분석이 완료되면 자동으로 결과가 표시돼요.',
    'RSI, MACD, 볼린저 밴드 등 보조지표의 시그널을 종합하여 추세를 판단하고 있어요.',
    '엘리어트 파동, 피보나치, 와이코프 등 다양한 전략을 데이터에 적용하고 있어요.',
    '매수·매도 타이밍, 손절가, 목표가까지 산출하여 실전에 바로 활용 가능한 분석을 제공합니다.',
    '헤드앤숄더, 더블바텀 등 차트 패턴과 캔들 패턴을 동시에 탐지하고 있어요.',
    '한 번 분석된 결과는 일정 시간 동안 캐시되어, 다음에 다시 열면 바로 확인할 수 있어요.',
] as const;

const TIP_INTERVAL_MS = 8000;
/** 조기 완료 시 마지막 단계로 이동하기 전 잠시 멈추는 시간(ms). */
const FINISHING_HOLD_MS = 3500;
/** 마무리 모드에서 단계를 한 칸씩 진행시키는 간격(ms). */
const FINISHING_STEP_MS = 1000;
/** 마지막 단계에 도달한 뒤 onFinished를 호출하기까지의 여유(ms). */
const FINISHING_TAIL_MS = 600;

interface UseAnalysisProgressOptions {
    /** 부모의 실제 분석 진행 상태. true → 진행 중, false → 응답 도착. */
    isAnalyzing: boolean;
    /** 마무리 애니메이션까지 모두 끝난 시점에 호출된다. */
    onFinished?: () => void;
}

interface UseAnalysisProgressResult {
    phaseIndex: number;
    tipIndex: number;
}

/**
 * AI 분석 진행 상태(단계 인덱스, 팁 인덱스)를 관리한다.
 *
 * 이 훅을 ChartContent에서 한 번만 호출하고, 반환값을 AnalysisProgress 컴포넌트에
 * props로 전달한다. 그래야 데스크톱·모바일 두 인스턴스가 동일한 상태를 공유하고,
 * 모바일 시트의 unmount/remount 사이클에서도 상태가 초기화되지 않는다.
 */
export function useAnalysisProgress({
    isAnalyzing,
    onFinished,
}: UseAnalysisProgressOptions): UseAnalysisProgressResult {
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const [finishing, setFinishing] = useState(false);
    const [prevIsAnalyzing, setPrevIsAnalyzing] = useState(isAnalyzing);

    // 항상 최신 onFinished를 호출하기 위한 ref. 마무리 effect 자체는 한 번만 돌아야 하므로
    // onFinished를 deps에 넣지 않고 ref로 우회한다.
    const onFinishedRef = useRef(onFinished);

    // isAnalyzing 전환을 감지하여 상태를 관리한다.
    // 렌더 중 setState: effect 없이 prop 변화를 즉시 반영하는 React 공식 파생 상태 패턴.
    if (prevIsAnalyzing !== isAnalyzing) {
        setPrevIsAnalyzing(isAnalyzing);
        if (isAnalyzing) {
            // 새 분석 시작 — 이전 분석에서 남은 phaseIndex·tipIndex·finishing을 초기화한다.
            // 초기화하지 않으면 finishing=true가 유지된 채로 재분석이 완료될 때
            // setFinishing(true) 호출 조건(!finishing)이 충족되지 않아 finishing effect가
            // 재실행되지 않고, onFinished가 영원히 호출되지 않아 결과가 표시되지 않는다.
            setPhaseIndex(0);
            setTipIndex(0);
            setFinishing(false);
        } else if (!finishing) {
            // 분석 완료 — 마무리 애니메이션 시작.
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

    // 팁 메시지를 일정 간격으로 순환시킨다.
    useEffect(() => {
        if (!isAnalyzing || finishing) return;
        const intervalId = window.setInterval(() => {
            setTipIndex(prev => (prev + 1) % ANALYSIS_TIPS.length);
        }, TIP_INTERVAL_MS);
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

    return { phaseIndex, tipIndex };
}
