'use client';

import { useCallback, useState } from 'react';
import type { SignupNudgeKind } from '@/features/analysis-nudge/ui/AnalysisSignupNudgeModal';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';

/** 공유 가입 넛지 모달의 열림 상태 — 어떤 문구를, 어떤 계기로. */
export interface SignupNudgeState {
    kind: SignupNudgeKind;
    variant: SignupNudgeVariant;
}

/** {@link useSignupNudgeControls}의 결과. 세 함수는 모두 안정 참조다. */
export interface SignupNudgeControls {
    /** 지금 열린 넛지. 닫혀 있으면 `null`. 모달을 그리는 provider만 읽는다. */
    signupNudge: SignupNudgeState | null;
    /** 잠긴 추론 토글 클릭. 문구는 늘 상세 분석이고, 퍼널에는 `reasoning_toggle`로 남는다. */
    openSignupNudge: () => void;
    /** 익명 첫 분석 자동 넛지. 문구를 번갈아 쓰고, 퍼널에는 `anon_auto`+variant로 남는다. */
    openSignupNudgeAs: (variant: SignupNudgeVariant) => void;
    closeSignupNudge: () => void;
}

/**
 * 종목 페이지에 하나뿐인 가입 넛지 모달의 열림 상태. `SymbolModelProvider`가 쓰고, 열림
 * 상태 자체는 컨텍스트 값에 싣지 않는다 — 열고 닫을 때 `useSymbolModel()` 소비자 전체가
 * 다시 렌더되지 않게 하려는 것이다. 이미 열린 상태에서 다시 열면 문구만 바뀐다.
 */
export function useSignupNudgeControls(): SignupNudgeControls {
    const [signupNudge, setSignupNudge] = useState<SignupNudgeState | null>(
        null
    );

    const openSignupNudge = useCallback(
        () =>
            setSignupNudge({ kind: 'reasoning_toggle', variant: 'reasoning' }),
        []
    );
    const openSignupNudgeAs = useCallback(
        (variant: SignupNudgeVariant) =>
            setSignupNudge({ kind: 'anon_auto', variant }),
        []
    );
    const closeSignupNudge = useCallback(() => setSignupNudge(null), []);

    return {
        signupNudge,
        openSignupNudge,
        openSignupNudgeAs,
        closeSignupNudge,
    };
}
