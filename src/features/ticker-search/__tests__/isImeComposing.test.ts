import type { KeyboardEvent } from 'react';
import { isImeComposing } from '@/features/ticker-search/lib/isImeComposing';

function keyEvent(nativeEvent: {
    isComposing: boolean;
    keyCode: number;
}): KeyboardEvent<HTMLInputElement> {
    return {
        key: 'Enter',
        nativeEvent,
    } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('isImeComposing', () => {
    it('isComposing이면 true', () => {
        expect(
            isImeComposing(keyEvent({ isComposing: true, keyCode: 13 }))
        ).toBe(true);
    });

    it('Safari 조합 확정 Enter(keyCode 229)도 true', () => {
        expect(
            isImeComposing(keyEvent({ isComposing: false, keyCode: 229 }))
        ).toBe(true);
    });

    it('일반 Enter는 false', () => {
        expect(
            isImeComposing(keyEvent({ isComposing: false, keyCode: 13 }))
        ).toBe(false);
    });
});
