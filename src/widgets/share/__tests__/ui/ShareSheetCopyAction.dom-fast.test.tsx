import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShareSheetCopyAction } from '../../ui/sheet/ShareSheetCopyAction';

const SHARE_URL = 'https://siglens.io/share/copy';

function renderCopyAction(
    overrides: Partial<Parameters<typeof ShareSheetCopyAction>[0]> = {}
) {
    const props = {
        buttonRef: createRef<HTMLButtonElement>(),
        shareUrl: SHARE_URL,
        copied: false,
        copyFailed: false,
        onCopy: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
    const view = render(<ShareSheetCopyAction {...props} />);
    return { ...props, ...view };
}

describe('ShareSheetCopyAction', () => {
    it('calls onCopy when the copy button is clicked', () => {
        const { onCopy } = renderCopyAction();
        fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('attaches the forwarded ref to the copy button', () => {
        const { buttonRef } = renderCopyAction();
        expect(buttonRef.current).toBe(
            screen.getByRole('button', { name: '링크 복사' })
        );
    });

    describe('before copying', () => {
        it('keeps the live region empty', () => {
            const { container } = renderCopyAction();
            expect(
                container.querySelector('[aria-live="polite"]')
            ).toBeEmptyDOMElement();
        });

        it('does not render the fallback input', () => {
            renderCopyAction();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
    });

    describe('after a successful copy', () => {
        it('announces the copy in the live region', () => {
            const { container } = renderCopyAction({ copied: true });
            expect(
                container.querySelector('[aria-live="polite"]')
            ).toHaveTextContent('링크를 복사했어요');
        });

        it('switches the button label to the copied state', () => {
            renderCopyAction({ copied: true });
            expect(
                screen.getByRole('button', { name: '복사됨' })
            ).toBeInTheDocument();
        });
    });

    describe('after a failed copy', () => {
        it('renders the read-only fallback input with the share URL', () => {
            renderCopyAction({ copyFailed: true });
            const input = screen.getByRole('textbox', {
                name: '공유 링크 (직접 복사)',
            });
            expect(input).toHaveAttribute('readonly');
            expect(input).toHaveValue(SHARE_URL);
        });

        it('focuses the fallback input on mount', () => {
            renderCopyAction({ copyFailed: true });
            expect(
                screen.getByRole('textbox', { name: '공유 링크 (직접 복사)' })
            ).toHaveFocus();
        });

        it('does not steal focus back on an unrelated re-render', () => {
            const props = renderCopyAction({ copyFailed: true });
            const button = screen.getByRole('button', { name: '링크 복사' });
            button.focus();

            props.rerender(
                <ShareSheetCopyAction
                    buttonRef={props.buttonRef}
                    shareUrl={SHARE_URL}
                    copied
                    copyFailed
                    onCopy={props.onCopy}
                />
            );

            expect(
                screen.getByRole('button', { name: '복사됨' })
            ).toHaveFocus();
        });
    });
});
