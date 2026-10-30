import { fireEvent, renderHook } from '@testing-library/react';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';

function setup(enabled = true) {
    const container = document.createElement('div');
    const trigger = document.createElement('button');
    const inside = document.createElement('a');
    inside.href = '#inside';
    const outside = document.createElement('input');
    container.append(trigger, inside);
    document.body.append(container, outside);
    const onClose = vi.fn();
    renderHook(() =>
        useEscapeDismiss({
            containerRef: { current: container },
            triggerRef: { current: trigger },
            enabled,
            onClose,
        })
    );
    return { trigger, inside, outside, onClose };
}

describe('useEscapeDismiss', () => {
    it('포커스가 컨테이너 안에 있으면 닫고 트리거로 포커스를 돌려준다', () => {
        const { trigger, inside, onClose } = setup();
        inside.focus();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(trigger).toHaveFocus();
    });

    it('포커스가 컨테이너 밖에 있으면 닫기만 하고 포커스를 옮기지 않는다', () => {
        const { trigger, outside, onClose } = setup();
        outside.focus();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(trigger).not.toHaveFocus();
        expect(outside).toHaveFocus();
    });

    it('enabled가 false면 반응하지 않는다', () => {
        const { onClose } = setup(false);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();
    });
});
