import { render, renderHook, screen } from '@testing-library/react';
import { useProviderCardFocus } from '@/features/api-key-management/hooks/useProviderCardFocus';

interface HarnessProps {
    showSaveInput: boolean;
    restoreFocus: boolean;
    onFocusRestored?: () => void;
}

function Harness({
    showSaveInput,
    restoreFocus,
    onFocusRestored = () => {},
}: HarnessProps) {
    const { inputRef, reRegisterRef } = useProviderCardFocus({
        showSaveInput,
        restoreFocus,
        onFocusRestored,
    });
    return showSaveInput ? (
        <input ref={inputRef} aria-label="key" />
    ) : (
        <button ref={reRegisterRef} type="button">
            re-register
        </button>
    );
}

describe('useProviderCardFocus', () => {
    it('leaves focus alone on mount without a restore request', () => {
        const onFocusRestored = vi.fn();
        render(
            <Harness
                showSaveInput
                restoreFocus={false}
                onFocusRestored={onFocusRestored}
            />
        );
        expect(document.body).toHaveFocus();
        expect(onFocusRestored).not.toHaveBeenCalled();
    });

    it('focuses the key input on mount when restoring an open form', () => {
        render(<Harness showSaveInput restoreFocus />);
        expect(screen.getByLabelText('key')).toHaveFocus();
    });

    it('focuses the re-register button on mount when restoring a closed form', () => {
        render(<Harness showSaveInput={false} restoreFocus />);
        expect(
            screen.getByRole('button', { name: 're-register' })
        ).toHaveFocus();
    });

    it('reports the hand-off once focus is restored', () => {
        const onFocusRestored = vi.fn();
        render(
            <Harness
                showSaveInput={false}
                restoreFocus
                onFocusRestored={onFocusRestored}
            />
        );
        expect(onFocusRestored).toHaveBeenCalled();
    });

    it('takes focus when the restore request arrives after mount', () => {
        const { rerender } = render(
            <Harness showSaveInput={false} restoreFocus={false} />
        );
        expect(document.body).toHaveFocus();

        rerender(<Harness showSaveInput={false} restoreFocus />);

        expect(
            screen.getByRole('button', { name: 're-register' })
        ).toHaveFocus();
    });

    it('focuses the key input when the form opens', () => {
        const { rerender } = render(
            <Harness showSaveInput={false} restoreFocus={false} />
        );

        rerender(<Harness showSaveInput restoreFocus={false} />);

        expect(screen.getByLabelText('key')).toHaveFocus();
    });

    it('focuses the re-register button when the form closes', () => {
        const { rerender } = render(
            <Harness showSaveInput restoreFocus={false} />
        );

        rerender(<Harness showSaveInput={false} restoreFocus={false} />);

        expect(
            screen.getByRole('button', { name: 're-register' })
        ).toHaveFocus();
    });

    it('does not refocus once the restore request is cleared', () => {
        const { rerender } = render(<Harness showSaveInput restoreFocus />);
        screen.getByLabelText('key').blur();

        rerender(<Harness showSaveInput restoreFocus={false} />);

        expect(document.body).toHaveFocus();
    });

    it('returns stable refs across re-renders', () => {
        const onFocusRestored = vi.fn();
        const { result, rerender } = renderHook(
            ({ show }) =>
                useProviderCardFocus({
                    showSaveInput: show,
                    restoreFocus: false,
                    onFocusRestored,
                }),
            { initialProps: { show: true } }
        );
        const { inputRef, reRegisterRef } = result.current;

        rerender({ show: false });

        expect(result.current.inputRef).toBe(inputRef);
        expect(result.current.reRegisterRef).toBe(reRegisterRef);
    });
});
