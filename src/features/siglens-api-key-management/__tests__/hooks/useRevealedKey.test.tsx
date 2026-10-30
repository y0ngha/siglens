import { act, renderHook } from '@testing-library/react';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { useRevealedKey } from '@/features/siglens-api-key-management/hooks/useRevealedKey';

const RAW_KEY = `slk_${'Ab3'.repeat(13)}A`;
const NEXT_RAW_KEY = `slk_${'Xy7'.repeat(13)}X`;
const IDLE: CreateSiglensApiKeyState = { status: 'idle' };
const CREATED: CreateSiglensApiKeyState = {
    status: 'created',
    rawKey: RAW_KEY,
    keyName: '첫 키',
    keyPrefix: RAW_KEY.slice(0, 10),
};
const ERROR: CreateSiglensApiKeyState = {
    status: 'error',
    code: 'invalid_name',
    message: '키 이름을 확인해 주세요.',
};

function renderRevealed(initial: CreateSiglensApiKeyState) {
    return renderHook(({ state }) => useRevealedKey(state), {
        initialProps: { state: initial },
    });
}

describe('useRevealedKey', () => {
    it('발급 전에는 보여 줄 원문이 없다', () => {
        const { result } = renderRevealed(IDLE);
        expect(result.current.revealedKey).toBeNull();
    });

    it('새 발급 결과가 오면 그 원문을 보여 준다', () => {
        const { result, rerender } = renderRevealed(IDLE);
        rerender({ state: CREATED });
        expect(result.current.revealedKey).toBe(RAW_KEY);
    });

    it('이어진 발급이 실패해도 원문을 지우지 않는다', () => {
        const { result, rerender } = renderRevealed(CREATED);
        rerender({ state: ERROR });
        expect(result.current.revealedKey).toBe(RAW_KEY);
    });

    it('다음 키를 만들면 그 원문으로 바뀐다', () => {
        const { result, rerender } = renderRevealed(CREATED);
        rerender({ state: { ...CREATED, rawKey: NEXT_RAW_KEY } });
        expect(result.current.revealedKey).toBe(NEXT_RAW_KEY);
    });

    it('새 키가 발급되면 다시 마운트용 번호가 오른다', () => {
        const { result, rerender } = renderRevealed(CREATED);
        const before = result.current.revealId;
        rerender({ state: { ...CREATED, rawKey: NEXT_RAW_KEY } });
        expect(result.current.revealId).toBe(before + 1);
    });

    it('발급이 실패하면 다시 마운트용 번호가 그대로다', () => {
        const { result, rerender } = renderRevealed(CREATED);
        const before = result.current.revealId;
        rerender({ state: ERROR });
        expect(result.current.revealId).toBe(before);
    });

    it('dismiss하면 원문을 치운다', () => {
        const { result } = renderRevealed(CREATED);
        act(() => result.current.dismiss());
        expect(result.current.revealedKey).toBeNull();
    });

    it('치운 뒤 같은 결과로 다시 렌더해도 원문이 돌아오지 않는다', () => {
        const { result, rerender } = renderRevealed(CREATED);
        act(() => result.current.dismiss());
        rerender({ state: CREATED });
        expect(result.current.revealedKey).toBeNull();
    });

    it('dismiss는 렌더가 바뀌어도 같은 함수다', () => {
        const { result, rerender } = renderRevealed(IDLE);
        const first = result.current.dismiss;
        rerender({ state: CREATED });
        expect(result.current.dismiss).toBe(first);
    });
});
