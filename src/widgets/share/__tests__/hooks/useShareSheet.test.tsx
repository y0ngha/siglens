import { act, fireEvent, renderHook } from '@testing-library/react';
import { buildTweetIntentUrl } from '@/shared/lib/share';
import { useShareSheet } from '../../hooks/useShareSheet';

const SHARE_URL = 'https://siglens.io/share/xyz';
const TWEET_TEXT = 'NVDA 분석';

function stubClipboard(writeText: () => Promise<void>): void {
    vi.stubGlobal('navigator', { clipboard: { writeText } });
}

function renderSheetHook(anchor: HTMLElement | null = null) {
    const onClose = vi.fn();
    const hook = renderHook(() =>
        useShareSheet({
            shareUrl: SHARE_URL,
            tweetText: TWEET_TEXT,
            anchorRef: { current: anchor },
            onClose,
        })
    );
    return { ...hook, onClose };
}

describe('useShareSheet', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds the tweet intent URL from the tweet text and share URL', () => {
        const { result } = renderSheetHook();
        expect(result.current.tweetUrl).toBe(
            buildTweetIntentUrl({ text: TWEET_TEXT, shareUrl: SHARE_URL })
        );
    });

    describe('handleCopy', () => {
        it('writes the share URL to the clipboard', async () => {
            const writeText = vi.fn().mockResolvedValue(undefined);
            stubClipboard(writeText);
            const { result } = renderSheetHook();

            await act(() => result.current.handleCopy());

            expect(writeText).toHaveBeenCalledWith(SHARE_URL);
        });

        it('reports copied and no failure when the write succeeds', async () => {
            stubClipboard(vi.fn().mockResolvedValue(undefined));
            const { result } = renderSheetHook();

            await act(() => result.current.handleCopy());

            expect(result.current.copied).toBe(true);
            expect(result.current.copyFailed).toBe(false);
        });

        it('sets copyFailed when the write rejects', async () => {
            stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
            const { result } = renderSheetHook();

            await act(() => result.current.handleCopy());

            expect(result.current.copyFailed).toBe(true);
        });

        it('clears copyFailed when a later attempt succeeds', async () => {
            const writeText = vi
                .fn()
                .mockRejectedValueOnce(new Error('denied'))
                .mockResolvedValueOnce(undefined);
            stubClipboard(writeText);
            const { result } = renderSheetHook();

            await act(() => result.current.handleCopy());
            await act(() => result.current.handleCopy());

            expect(result.current.copyFailed).toBe(false);
        });
    });

    describe('dismissal', () => {
        it('calls onClose on Escape', () => {
            const { onClose } = renderSheetHook();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose on pointerdown outside the panel and anchor', () => {
            const { onClose } = renderSheetHook();
            fireEvent.pointerDown(document.body);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose on pointerdown on the anchor', () => {
            const anchor = document.createElement('button');
            document.body.appendChild(anchor);
            const { onClose } = renderSheetHook(anchor);

            fireEvent.pointerDown(anchor);

            expect(onClose).not.toHaveBeenCalled();
            anchor.remove();
        });
    });
});
