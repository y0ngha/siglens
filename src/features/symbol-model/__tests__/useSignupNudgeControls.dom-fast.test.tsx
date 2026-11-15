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

    it('openTimeframeNudge는 잠긴 시간 프레임 계기·시간 프레임 문구로 연다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());

        act(() => result.current.openTimeframeNudge());

        expect(result.current.signupNudge).toEqual({
            kind: 'timeframe_nudge',
            variant: 'timeframe',
        });
    });

    it('openTimeframeNudge는 마운트당 한 번만 연다 — 닫은 뒤 다시 눌러도 열리지 않는다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());

        act(() => result.current.openTimeframeNudge());
        act(() => result.current.closeSignupNudge());
        act(() => result.current.openTimeframeNudge());

        expect(result.current.signupNudge).toBeNull();
    });

    it('시간 프레임 넛지를 이미 썼어도 다른 넛지는 열린다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());
        act(() => result.current.openTimeframeNudge());
        act(() => result.current.closeSignupNudge());

        act(() => result.current.openSignupNudge());

        expect(result.current.signupNudge?.kind).toBe('reasoning_toggle');
    });

    it('closeSignupNudge는 닫는다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());
        act(() => result.current.openSignupNudge());

        act(() => result.current.closeSignupNudge());

        expect(result.current.signupNudge).toBeNull();
    });

    it('열고 닫아도 네 함수의 참조는 그대로다', () => {
        const { result } = renderHook(() => useSignupNudgeControls());
        const before = result.current;

        act(() => result.current.openSignupNudge());

        expect([
            result.current.openSignupNudge,
            result.current.openSignupNudgeAs,
            result.current.openTimeframeNudge,
            result.current.closeSignupNudge,
        ]).toEqual([
            before.openSignupNudge,
            before.openSignupNudgeAs,
            before.openTimeframeNudge,
            before.closeSignupNudge,
        ]);
    });
});
