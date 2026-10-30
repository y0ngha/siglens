import { act, fireEvent, renderHook } from '@testing-library/react';
import type {
    FocusEvent as ReactFocusEvent,
    PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavMenuDisclosure } from '../../hooks/useNavMenuDisclosure';

const pointer = (pointerType: string) =>
    ({ pointerType }) as unknown as ReactPointerEvent;

describe('useNavMenuDisclosure', () => {
    it('마우스가 들어오면 열고 나가면 닫는다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onPointerEnter(pointer('mouse')));
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.onPointerLeave(pointer('mouse')));
        expect(result.current.isOpen).toBe(false);
    });

    it.each(['touch', 'pen'])('%s 포인터는 호버로 열지 않는다', type => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onPointerEnter(pointer(type)));

        expect(result.current.isOpen).toBe(false);
    });

    it('호버로 열린 뒤 클릭해도 열린 채 유지된다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onPointerEnter(pointer('mouse')));
        act(() => result.current.onTriggerClick());

        expect(result.current.isOpen).toBe(true);
    });

    it('호버로만 열린 메뉴는 포인터가 나가면 닫힌다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onPointerEnter(pointer('mouse')));
        act(() => result.current.onPointerLeave(pointer('mouse')));

        expect(result.current.isOpen).toBe(false);
    });

    it('호버 뒤 클릭으로 고정한 메뉴는 포인터가 나가도 열린 채 유지된다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onPointerEnter(pointer('mouse')));
        act(() => result.current.onTriggerClick());
        act(() => result.current.onPointerLeave(pointer('mouse')));

        expect(result.current.isOpen).toBe(true);
    });

    it('클릭으로 연 뒤 다시 클릭하면 닫힌다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onTriggerClick());
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.onTriggerClick());
        expect(result.current.isOpen).toBe(false);
    });

    it('클릭으로 연 메뉴에 다시 포인터가 들어와도 클릭 상태가 유지된다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());

        act(() => result.current.onTriggerClick());
        act(() => result.current.onPointerEnter(pointer('mouse')));
        act(() => result.current.onTriggerClick());

        expect(result.current.isOpen).toBe(false);
    });

    it('컨테이너 밖으로 포커스가 나가면 닫고, 안쪽 이동이나 도착 요소가 없으면 유지한다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());
        const container = document.createElement('div');
        const inner = document.createElement('a');
        const outer = document.createElement('a');
        container.append(inner);
        const blur = (relatedTarget: EventTarget | null) =>
            ({
                relatedTarget,
                currentTarget: container,
            }) as unknown as ReactFocusEvent<HTMLElement>;

        act(() => result.current.onTriggerClick());
        act(() => result.current.onBlur(blur(inner)));
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.onBlur(blur(null)));
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.onBlur(blur(outer)));
        expect(result.current.isOpen).toBe(false);
    });

    it('열려 있는 동안 Escape로 닫는다', () => {
        const { result } = renderHook(() => useNavMenuDisclosure());
        act(() => result.current.onTriggerClick());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(result.current.isOpen).toBe(false);
    });
});
