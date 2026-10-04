import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useHumanInteracted } from '../useHumanInteracted';
import {
    __resetHumanInteractionForTests,
    markHumanInteracted,
} from '@/shared/lib/humanInteractionStore';

describe('useHumanInteracted', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        __resetHumanInteractionForTests();
    });
    afterEach(() => {
        __resetHumanInteractionForTests();
    });

    it('입력이 인정되면 리렌더되어 true를 돌려준다', () => {
        const { result } = renderHook(() => useHumanInteracted());
        expect(result.current).toBe(false);
        act(() => {
            markHumanInteracted();
        });
        expect(result.current).toBe(true);
    });
});
