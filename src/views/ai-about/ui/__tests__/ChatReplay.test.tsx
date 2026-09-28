import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import { ChatReplay } from '../ChatReplay';

const scenario = (id: string, question: string): ReplayScenario => ({
    id,
    question,
    tools: [
        {
            label: 'Quote',
            pendingLabel: 'Checking quote',
            subject: 'AAA',
            ms: 500,
        },
    ],
    lines: [
        parseReplayLine('p', `${id} closed at <b>100</b>.`),
        parseReplayLine('li', 'Up <up>+1%</up>'),
    ],
    summary: 'Quote checked · 0.5s',
    sources: ['Quote'],
    asOf: 'as of close',
});

const SCENARIOS = [
    scenario('alpha', 'How is alpha doing?'),
    scenario('beta', 'How is beta doing?'),
];
const LABELS = {
    region: 'Example conversation',
    pause: 'Pause',
    resume: 'Play',
    sources: 'Sources',
};

function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
            matches: reduce,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })
    );
}

const renderReplay = () =>
    render(
        <ChatReplay
            scenarios={SCENARIOS}
            labels={LABELS}
            avatar={<span data-testid="avatar" />}
            doneIcon={<span data-testid="done" />}
        />
    );

const userBubbleText = () =>
    screen
        .getByRole('region', { name: 'Example conversation' })
        .querySelector('.self-end')?.textContent ?? '';

describe('ChatReplay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('first renders the first scenario complete (what SSR and crawlers get)', () => {
        mockReducedMotion(true);
        renderReplay();
        expect(userBubbleText()).toBe('How is alpha doing?');
        expect(screen.getByText(/alpha closed at/)).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('Quote checked · 0.5s')).toBeInTheDocument();
        expect(
            screen.getByText('as of close', { exact: false })
        ).toBeInTheDocument();
    });

    it('stays still with no pause control when the reader prefers reduced motion', async () => {
        mockReducedMotion(true);
        renderReplay();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(userBubbleText()).toBe('How is alpha doing?');
        expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    });

    it('types the question into the bubble after mount', async () => {
        mockReducedMotion(false);
        renderReplay();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        const typed = userBubbleText();
        expect(typed.length).toBeGreaterThan(0);
        expect(typed.length).toBeLessThan('How is alpha doing?'.length);
        expect('How is alpha doing?'.startsWith(typed)).toBe(true);
    });

    it('freezes while paused', async () => {
        mockReducedMotion(false);
        renderReplay();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        const button = screen.getByRole('button', { name: 'Pause' });
        fireEvent.click(button);
        expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        const before = userBubbleText();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(userBubbleText()).toBe(before);
    });
});
