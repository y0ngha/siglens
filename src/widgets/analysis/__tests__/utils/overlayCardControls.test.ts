import type { PointerEvent } from 'react';
import {
    overlayHoverHandlers,
    toOverlayCardControls,
} from '@/widgets/analysis/utils/overlayCardControls';
import type { OverlayCardControls } from '@/widgets/analysis/model/types';

const pointer = (pointerType: string) => ({ pointerType }) as PointerEvent;

function makeControls(): OverlayCardControls {
    return {
        hiddenKeys: new Set(),
        onToggle: vi.fn(),
        onHighlight: vi.fn(),
        onClearHighlight: vi.fn(),
    };
}

describe('toOverlayCardControls', () => {
    it('콜백이 하나라도 없으면 undefined다', () => {
        expect(
            toOverlayCardControls(new Set(), vi.fn(), vi.fn(), undefined)
        ).toBeUndefined();
    });

    it('콜백이 모두 있으면 묶음을 돌려준다', () => {
        const hiddenKeys = new Set(['a']);
        const controls = toOverlayCardControls(
            hiddenKeys,
            vi.fn(),
            vi.fn(),
            vi.fn()
        );
        expect(controls?.hiddenKeys).toBe(hiddenKeys);
    });
});

describe('overlayHoverHandlers', () => {
    it('작도가 없으면 빈 객체다', () => {
        expect(overlayHoverHandlers(undefined, 'k')).toEqual({});
    });

    it('마우스 포인터만 강조를 걸고, 떠날 때는 자기 key만 멱등 해제한다', () => {
        const controls = makeControls();
        const handlers = overlayHoverHandlers(controls, 'k');

        handlers.onPointerEnter?.(pointer('touch'));
        expect(controls.onHighlight).not.toHaveBeenCalled();

        handlers.onPointerEnter?.(pointer('mouse'));
        expect(controls.onHighlight).toHaveBeenCalledWith('k');

        handlers.onPointerLeave?.(pointer('mouse'));
        // `onHighlight(null)`은 다른 카드(키보드 포커스)의 강조까지 지운다.
        expect(controls.onHighlight).not.toHaveBeenCalledWith(null);
        expect(controls.onClearHighlight).toHaveBeenCalledWith('k');
    });
});
