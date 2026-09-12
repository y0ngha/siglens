import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '@/widgets/agent-chat/Composer';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

function renderComposer(
    over: Partial<React.ComponentProps<typeof Composer>> = {}
) {
    const props = {
        disabled: false,
        streaming: false,
        remainingTurns: 5,
        onSend: vi.fn(),
        onStop: vi.fn(),
        ...over,
    };
    wrap(<Composer {...props} />);
    return props;
}

describe('Composer', () => {
    it('Enter sends, Shift+Enter does not, over 4,000 chars disables send', () => {
        const { onSend } = renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('안녕');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
        expect(box).toHaveAttribute('aria-invalid', 'true');
    });

    it('refocuses the textarea after sending', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(box).toHaveFocus();
    });

    it('shows a full ICU sentence (not a fragment glued onto the counter) once over the limit', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(
            screen.getByText('4,001 / 4,000자 — 너무 깁니다')
        ).toBeInTheDocument();
    });

    it('keeps the counter out of the way until the message nears the cap', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        expect(screen.queryByText(/\/ 4,000$/)).toBeNull();
        expect(
            screen.getByText('Enter 전송 · Shift+Enter 줄바꿈')
        ).toBeInTheDocument();
        fireEvent.change(box, { target: { value: 'x'.repeat(3200) } });
        expect(screen.getByText('3,200 / 4,000')).toBeInTheDocument();
        expect(
            screen.queryByText('Enter 전송 · Shift+Enter 줄바꿈')
        ).toBeNull();
    });

    it('shows a stop button while streaming and no send button', () => {
        const { onStop } = renderComposer({ streaming: true });
        fireEvent.click(screen.getByRole('button', { name: '중단' }));
        expect(onStop).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '전송' })).toBeNull();
    });

    it('the action button and the textarea share the 44px row (spec R4)', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        const send = screen.getByRole('button', { name: '전송' });
        expect(box.className).toMatch(/\bmin-h-11\b/);
        expect(send.className).toMatch(/\bsize-11\b/);
        // Disabled is expressed with opaque tokens, never `disabled:opacity-*`.
        expect(send.className).not.toMatch(/opacity/);
        // Icon-only control: the accessible name comes from aria-label, the SVG is hidden.
        expect(send.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });
});
