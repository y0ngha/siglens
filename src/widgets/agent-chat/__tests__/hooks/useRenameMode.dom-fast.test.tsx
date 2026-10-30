import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRenameMode } from '@/widgets/agent-chat/hooks/useRenameMode';

function Harness() {
    const { rowRef, inputRef, ...rename } = useRenameMode();
    return (
        <div>
            <button
                type="button"
                data-testid="trigger"
                onClick={e => rename.open('c1', 'title', e.currentTarget)}
            >
                edit
            </button>
            <button type="button" data-testid="close" onClick={rename.close}>
                close
            </button>
            <button type="button" data-testid="outside">
                outside
            </button>
            <ul>
                <li ref={rowRef} data-testid="row">
                    {rename.draft && (
                        <input
                            ref={inputRef}
                            data-testid="input"
                            value={rename.draft.title}
                            onChange={e => rename.change(e.target.value)}
                        />
                    )}
                </li>
            </ul>
        </div>
    );
}

describe('useRenameMode', () => {
    it('starts with no draft', () => {
        const { result } = renderHook(() => useRenameMode());
        expect(result.current.draft).toBeNull();
    });

    it('opens a draft with the row id and title', () => {
        const { result } = renderHook(() => useRenameMode());
        act(() =>
            result.current.open('c1', 'hello', document.createElement('button'))
        );
        expect(result.current.draft).toEqual({ id: 'c1', title: 'hello' });
    });

    it('updates only the title on change', () => {
        const { result } = renderHook(() => useRenameMode());
        act(() =>
            result.current.open('c1', 'a', document.createElement('button'))
        );
        act(() => result.current.change('abc'));
        expect(result.current.draft).toEqual({ id: 'c1', title: 'abc' });
    });

    it('ignores change when no draft is open', () => {
        const { result } = renderHook(() => useRenameMode());
        act(() => result.current.change('abc'));
        expect(result.current.draft).toBeNull();
    });

    it('focuses the input once the draft opens', () => {
        const { getByTestId } = render(<Harness />);
        fireEvent.click(getByTestId('trigger'));
        expect(getByTestId('input')).toHaveFocus();
    });

    it('keeps the caret target focused while typing', () => {
        const { getByTestId } = render(<Harness />);
        fireEvent.click(getByTestId('trigger'));
        fireEvent.change(getByTestId('input'), { target: { value: 'typed' } });
        expect(getByTestId('input')).toHaveValue('typed');
        expect(getByTestId('input')).toHaveFocus();
    });

    it('closes the draft and returns focus to the opening button', () => {
        const { getByTestId, queryByTestId } = render(<Harness />);
        const trigger = getByTestId('trigger');
        fireEvent.click(trigger);
        fireEvent.click(getByTestId('close'));
        expect(queryByTestId('input')).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it('cancels on a pointer press outside the row without stealing focus back', () => {
        const { getByTestId, queryByTestId } = render(<Harness />);
        const trigger = getByTestId('trigger');
        fireEvent.click(trigger);
        const outside = getByTestId('outside');
        outside.focus();
        fireEvent.pointerDown(outside);
        expect(queryByTestId('input')).toBeNull();
        expect(trigger).not.toHaveFocus();
        expect(outside).toHaveFocus();
    });

    it('stays open on a pointer press inside the row', () => {
        const { getByTestId } = render(<Harness />);
        fireEvent.click(getByTestId('trigger'));
        fireEvent.pointerDown(getByTestId('input'));
        expect(getByTestId('input')).toBeInTheDocument();
    });

    it('stays open when the input blurs', () => {
        const { getByTestId } = render(<Harness />);
        fireEvent.click(getByTestId('trigger'));
        fireEvent.blur(getByTestId('input'));
        expect(getByTestId('input')).toBeInTheDocument();
    });
});
