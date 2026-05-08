/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHeaderChip } from '@/components/symbol-page/FearGreedHeaderChip';

const make = (
    label: FearGreedSnapshot['label'],
    confidence: FearGreedSnapshot['confidence'] = 'normal'
): FearGreedSnapshot => ({
    score: 50,
    label,
    groups: [],
    confidence,
    sampleSize: 200,
    warning: null,
});

describe('FearGreedHeaderChip', () => {
    describe('placeholder states', () => {
        // siglens-core 0.8.0 narrowed `FearGreedSnapshot.confidence` to
        // `Exclude<FearGreedConfidence, 'insufficient'>` — `'insufficient'`
        // is now unrepresentable in the type and surfaces as `null` from
        // computeFearGreedIndex. We therefore only test the `null` path.
        it('renders "데이터 부족" when snapshot is null', () => {
            const { getByText } = render(
                <FearGreedHeaderChip snapshot={null} />
            );
            expect(getByText(/데이터 부족/)).toBeInTheDocument();
        });
    });

    describe('label rendering', () => {
        it.each([
            ['EXTREME_FEAR' as const, '극공포'],
            ['FEAR' as const, '공포'],
            ['NEUTRAL' as const, '중립'],
            ['GREED' as const, '탐욕'],
            ['EXTREME_GREED' as const, '극탐욕'],
        ])('renders %s with text "%s"', (label, text) => {
            const { getByText } = render(
                <FearGreedHeaderChip snapshot={make(label)} />
            );
            expect(getByText(text)).toBeInTheDocument();
        });
    });

    describe('confidence indicator', () => {
        it('shows ⓘ when confidence is limited', () => {
            const { container } = render(
                <FearGreedHeaderChip snapshot={make('NEUTRAL', 'limited')} />
            );
            expect(container.textContent).toContain('ⓘ');
        });

        it('does not show ⓘ when confidence is normal', () => {
            const { container } = render(
                <FearGreedHeaderChip snapshot={make('NEUTRAL', 'normal')} />
            );
            expect(container.textContent).not.toContain('ⓘ');
        });
    });

    describe('score rendering', () => {
        it('rounds and renders the score', () => {
            const { getByText } = render(
                <FearGreedHeaderChip
                    snapshot={{ ...make('GREED'), score: 67.4 }}
                />
            );
            expect(getByText('67')).toBeInTheDocument();
        });
    });

    describe('aria-label', () => {
        it('exposes label, score, and confidence note via aria-label', () => {
            const { container } = render(
                <FearGreedHeaderChip
                    snapshot={{ ...make('GREED', 'limited'), score: 60.6 }}
                />
            );
            const chip = container.querySelector('[aria-label]');
            expect(chip?.getAttribute('aria-label')).toBe(
                '공포 탐욕 지수 탐욕 61점 (신뢰도 제한)'
            );
        });
    });
});
