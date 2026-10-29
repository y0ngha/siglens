'use client';

import { useEffect, useRef } from 'react';
import type { FocusTarget } from '../lib/signupFocusTarget';
import { PHASE_FIRST_FIELD_ID, type SignupPhase } from '../lib/signupPhase';

interface UseSignupFocusParams extends FocusTarget {
    phase: SignupPhase;
    /** 첫 렌더에서도 단계의 첫 입력에 포커스를 줄지(「이메일 수정」으로 다시 시작한 경우). */
    focusFirstFieldOnMount: boolean;
}

/**
 * 회원가입 흐름의 포커스 이동.
 *
 * 단계가 바뀌면 이전 단계의 폼이 통째로 언마운트되고, 방금 누른 제출 버튼이
 * 쥐고 있던 포커스는 `body`로 떨어진다 — 키보드 사용자는 페이지 맨 앞부터 다시
 * Tab해야 한다. 그래서 새 단계의 첫 입력으로 옮긴다. 첫 진입(페이지 로드)에는
 * 포커스를 빼앗지 않는다. 제출이 입력 오류로 끝나면 그 입력으로 옮겨, 오류 문구가
 * 연결된 자리에서 바로 고치게 한다.
 */
export function useSignupFocus({
    phase,
    focusFirstFieldOnMount,
    error,
    fieldId,
}: UseSignupFocusParams): void {
    // 마지막으로 포커스를 맞춘 단계. 마운트 시 현재 단계로 두면 첫 진입은 건너뛴다.
    const focusedPhaseRef = useRef<SignupPhase | null>(
        focusFirstFieldOnMount ? null : phase
    );

    useEffect(() => {
        if (focusedPhaseRef.current === phase) return;
        focusedPhaseRef.current = phase;
        document.getElementById(PHASE_FIRST_FIELD_ID[phase])?.focus();
    }, [phase]);

    // 마지막으로 처리한 오류 객체. 마운트 시점의 오류로 두어, 오류가 이미 담긴 채
    // 마운트된 흐름(라우터 캐시 복원 등)이 페이지 로드에서 포커스를 빼앗지 않게 한다.
    // 오류 객체의 참조가 그 뒤에 바뀔 때만 포커스를 옮긴다.
    const handledErrorRef = useRef<FocusTarget['error']>(error);

    useEffect(() => {
        if (handledErrorRef.current === error) return;
        handledErrorRef.current = error;
        if (!error || !fieldId) return;
        document.getElementById(fieldId)?.focus();
    }, [error, fieldId]);
}
