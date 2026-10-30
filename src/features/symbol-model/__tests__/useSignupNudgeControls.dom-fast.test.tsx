import { act, renderHook } from '@testing-library/react';
import { useSignupNudgeControls } from '@/features/symbol-model/hooks/useSignupNudgeControls';

describe('useSignupNudgeControls', () => {
    it('처음에는 닫혀 있다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());

        expect(result.current.signupNudge).toBeNull();
    });

    it('openSignupNudge는 잠금 토글 계기·상세 분석 문구로 연다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());

        act(() => result.current.openSignupNudge());

        expect(result.current.signupNudge).toEqual({
            kind: 'reasoning_toggle',
            variant: 'reasoning',
        });
    });

    it('openSignupNudgeAs는 자동 넛지 계기·요청한 문구로 연다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());

        act(() => result.current.openSignupNudgeAs('emailReport'));

        expect(result.current.signupNudge).toEqual({
            kind: 'anon_auto',
            variant: 'emailReport',
        });
    });

    it('closeSignupNudge는 닫는다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());
        act(() => result.current.openSignupNudge());

        act(() => result.current.closeSignupNudge());

        expect(result.current.signupNudge).toBeNull();
    });

    it('열고 닫아도 세 함수의 참조는 그대로다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());
        const before = result.current;

        act(() => result.current.openSignupNudge());

        expect([
            result.current.openSignupNudge,
            result.current.openSignupNudgeAs,
            result.current.closeSignupNudge,
        ]).toEqual([
            before.openSignupNudge,
            before.openSignupNudgeAs,
            before.closeSignupNudge,
        ]);
    });
});
