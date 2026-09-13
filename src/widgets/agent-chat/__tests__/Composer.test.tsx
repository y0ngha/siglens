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

describe('Composer', () => {
    it('Enter sends, Shift+Enter does not, over 4,000 chars disables send', () => {
        const onSend = vi.fn();
        wrap(
            <Composer
                disabled={false}
                streaming={false}
                remainingTurns={5}
                onSend={onSend}
                onStop={vi.fn()}
            />
        );
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('안녕');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(screen.getByRole('button', { name: /전송/ })).toBeDisabled();
    });

    it('refocuses the textarea after sending', () => {
        wrap(
            <Composer
                disabled={false}
                streaming={false}
                remainingTurns={5}
                onSend={vi.fn()}
                onStop={vi.fn()}
            />
        );
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(box).toHaveFocus();
    });

    it('shows a full ICU sentence (not a fragment glued onto the counter) once over the limit', () => {
        wrap(
            <Composer
                disabled={false}
                streaming={false}
                remainingTurns={5}
                onSend={vi.fn()}
                onStop={vi.fn()}
            />
        );
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(
            screen.getByText('4,001 / 4,000자 — 너무 깁니다')
        ).toBeInTheDocument();
    });

    it('shows a stop button while streaming', () => {
        const onStop = vi.fn();
        wrap(
            <Composer
                disabled={false}
                streaming
                remainingTurns={5}
                onSend={vi.fn()}
                onStop={onStop}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /중단/ }));
        expect(onStop).toHaveBeenCalled();
    });
});
