// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
import { CongressTrendSummaryView } from '../CongressTrendSummaryView';

const BASE_RESULT: CongressTrendResponse = {
    overallSentiment: 'bullish',
    summaryKo: '의회 매수 동향이 강하게 나타납니다.',
    notableMembersKo: [],
    riskNoteKo: '공시 지연이 있을 수 있어요.',
};

describe('CongressTrendSummaryView', () => {
    describe('riskNoteKo rendering', () => {
        it('renders "참고 사항" heading when riskNoteKo has content', () => {
            render(<CongressTrendSummaryView result={BASE_RESULT} />);
            expect(screen.getByText('참고 사항')).toBeDefined();
        });

        it('does NOT render "참고 사항" heading when riskNoteKo is empty string', () => {
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                riskNoteKo: '',
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.queryByText('참고 사항')).toBeNull();
        });

        it('does NOT render "참고 사항" heading when riskNoteKo is whitespace-only', () => {
            // F3: riskNoteKo.trim().length > 0 guard prevents whitespace-only
            // strings from rendering the section heading.
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                riskNoteKo: '   ',
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.queryByText('참고 사항')).toBeNull();
        });

        it('does NOT render "참고 사항" heading when riskNoteKo is newline-only', () => {
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                riskNoteKo: '\n\t\n',
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.queryByText('참고 사항')).toBeNull();
        });
    });

    describe('sentiment badge', () => {
        it('renders bullish sentiment label', () => {
            render(<CongressTrendSummaryView result={BASE_RESULT} />);
            expect(
                screen.getByRole('img', { name: /전반적 동향/ })
            ).toBeDefined();
            expect(screen.getByText('매수 우위')).toBeDefined();
        });

        it('renders bearish sentiment label', () => {
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                overallSentiment: 'bearish',
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.getByText('매도 우위')).toBeDefined();
        });

        it('renders neutral sentiment label', () => {
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                overallSentiment: 'neutral',
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.getByText('중립')).toBeDefined();
        });
    });

    describe('notableMembersKo', () => {
        it('does NOT render "주목할 인물" when list is empty', () => {
            render(<CongressTrendSummaryView result={BASE_RESULT} />);
            expect(screen.queryByText('주목할 인물')).toBeNull();
        });

        it('renders notable members when list has items', () => {
            const result: CongressTrendResponse = {
                ...BASE_RESULT,
                notableMembersKo: ['Nancy Pelosi (하원)'],
            };
            render(<CongressTrendSummaryView result={result} />);
            expect(screen.getByText('주목할 인물')).toBeDefined();
            expect(screen.getByText('Nancy Pelosi (하원)')).toBeDefined();
        });
    });
});
