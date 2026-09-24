import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import { ReportReplay } from '../ReportReplay';

const scenario = (id: string, ticker: string): ReplayScenario => ({
    id,
    question: ticker,
    tools: [
        {
            label: 'Chart',
            pendingLabel: 'Loading chart',
            subject: 'daily',
            ms: 500,
        },
    ],
    lines: [
        parseReplayLine('p', `<b>${ticker}</b> is trending up.`),
        parseReplayLine('li', 'Up <up>+1%</up>'),
    ],
    summary: 'Analyzed in 1 step',
    sources: ['Chart'],
    asOf: 'As of close',
});

const LABELS = {
    region: 'Example analysis',
    badge: 'Example',
    pause: 'Pause',
    resume: 'Play',
    sources: 'Based on',
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
        <ReportReplay
            scenarios={[scenario('a', 'AAPL'), scenario('b', 'BTCUSD')]}
            labels={LABELS}
            doneIcon={<span data-testid="done" />}
        />
    );

const addressBar = () =>
    screen.getByRole('region', { name: 'Example analysis' }).querySelector('p')
        ?.textContent ?? '';

describe('ReportReplay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('first renders the first report complete, with the ticker in an address bar', () => {
        mockReducedMotion(true);
        renderReplay();
        expect(addressBar()).toBe('siglens.io/AAPL');
        expect(screen.getByText('Analyzed in 1 step')).toBeInTheDocument();
        // Once in the address bar, once bold at the start of the report.
        expect(screen.getAllByText('AAPL')).toHaveLength(2);
        expect(screen.getByText('+1%')).toBeInTheDocument();
        expect(screen.getByText('Example')).toBeInTheDocument();
        const region = screen.getByRole('region', { name: 'Example analysis' });
        expect(region.textContent).not.toMatch(/<\/?(b|up|down)>/);
        // Not a form control: nothing on the example looks typeable.
        expect(region.querySelector('input, textarea')).toBeNull();
    });

    it('stays still with no pause control under reduced motion', async () => {
        mockReducedMotion(true);
        renderReplay();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(addressBar()).toBe('siglens.io/AAPL');
        expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    });

    it('types the ticker after mount, then lights up the steps', async () => {
        mockReducedMotion(false);
        renderReplay();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(330);
        });
        const typed = addressBar();
        expect(typed.startsWith('siglens.io/')).toBe(true);
        expect(typed.length).toBeLessThan('siglens.io/AAPL'.length);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        expect(screen.getByText('Loading chart')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Pause' })
        ).toBeInTheDocument();
    });
});
