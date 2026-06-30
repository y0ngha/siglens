/**
 * FearGreedShareView tests (T1 — 0% coverage baseline).
 *
 * Covers:
 * - Hero score + label rendered via FearGreedHero
 * - All group bars rendered via FearGreedGroupBar (groups.map branch)
 * - SelfNormWarningBadge rendered when warning is set
 * - Warning badge absent when warning is null
 * - Empty groups array (zero group bars)
 */
import { render, screen } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedShareView } from '../FearGreedShareView';
import { SENTIMENT_LABEL_TEXT } from '@/shared/lib/fearGreedLabels';
import { WARNING_TEXT } from '../SelfNormWarningBadge';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(
    overrides: Partial<FearGreedSnapshot> = {}
): FearGreedSnapshot {
    return {
        score: 28,
        label: 'FEAR',
        confidence: 'normal',
        sampleSize: 300,
        warning: null,
        groups: [
            {
                name: 'Flow',
                score: 32,
                factors: [
                    { key: 'volume_z', rawValue: -0.8, percentile: 30 },
                    { key: 'buysell_imbalance', rawValue: 0.1, percentile: 45 },
                    { key: 'poc_distance', rawValue: -0.02, percentile: 55 },
                ],
            },
            {
                name: 'Trend',
                score: 24,
                factors: [
                    { key: 'ma200_distance', rawValue: -0.05, percentile: 20 },
                    { key: 'range_position', rawValue: 0.3, percentile: 40 },
                ],
            },
        ],
        ...overrides,
    };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FearGreedShareView', () => {
    describe('hero score and label', () => {
        it('renders the rounded hero score', () => {
            render(
                <FearGreedShareView snapshot={makeSnapshot({ score: 28 })} />
            );
            // FearGreedGauge renders the score as text in the focal stack.
            expect(screen.getByText('28')).toBeInTheDocument();
        });

        it('renders the sentiment label text', () => {
            render(
                <FearGreedShareView
                    snapshot={makeSnapshot({ label: 'FEAR' })}
                />
            );
            expect(
                screen.getByText(SENTIMENT_LABEL_TEXT.FEAR)
            ).toBeInTheDocument();
        });

        it('renders EXTREME_FEAR label', () => {
            render(
                <FearGreedShareView
                    snapshot={makeSnapshot({
                        score: 12,
                        label: 'EXTREME_FEAR',
                    })}
                />
            );
            expect(screen.getByText('12')).toBeInTheDocument();
            expect(
                screen.getByText(SENTIMENT_LABEL_TEXT.EXTREME_FEAR)
            ).toBeInTheDocument();
        });
    });

    describe('group bars (snapshot.groups.map branch)', () => {
        it('renders a progressbar for each group', () => {
            render(<FearGreedShareView snapshot={makeSnapshot()} />);
            const bars = screen.getAllByRole('progressbar');
            // Default fixture has Flow + Trend
            expect(bars).toHaveLength(2);
        });

        it('renders each group name', () => {
            render(<FearGreedShareView snapshot={makeSnapshot()} />);
            expect(screen.getByText('Flow Group')).toBeInTheDocument();
            expect(screen.getByText('Trend Group')).toBeInTheDocument();
        });
    });

    describe('SelfNormWarningBadge branch', () => {
        it('renders no warning badge when warning is null', () => {
            render(
                <FearGreedShareView
                    snapshot={makeSnapshot({ warning: null })}
                />
            );
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('renders CHRONIC_WEAKNESS badge when warning is set', () => {
            render(
                <FearGreedShareView
                    snapshot={makeSnapshot({ warning: 'CHRONIC_WEAKNESS' })}
                />
            );
            expect(screen.getByRole('status')).toHaveTextContent(
                WARNING_TEXT.CHRONIC_WEAKNESS
            );
        });

        it('renders CHRONIC_STRENGTH badge when warning is set', () => {
            render(
                <FearGreedShareView
                    snapshot={makeSnapshot({ warning: 'CHRONIC_STRENGTH' })}
                />
            );
            expect(screen.getByRole('status')).toHaveTextContent(
                WARNING_TEXT.CHRONIC_STRENGTH
            );
        });
    });

    describe('empty groups branch', () => {
        it('renders no group bars when groups is empty', () => {
            render(
                <FearGreedShareView snapshot={makeSnapshot({ groups: [] })} />
            );
            expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
        });
    });
});
