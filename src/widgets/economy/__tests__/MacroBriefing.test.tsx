vi.mock('@/widgets/economy/hooks/useMacroBriefing');
vi.mock('@/widgets/economy/hooks/useMacroBriefingPoll');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { MacroBriefing } from '@/widgets/economy/sections/MacroBriefing';
import { useMacroBriefing } from '@/widgets/economy/hooks/useMacroBriefing';
import { useMacroBriefingPoll } from '@/widgets/economy/hooks/useMacroBriefingPoll';

const mockUseBriefing = vi.mocked(useMacroBriefing);
const mockUsePoll = vi.mocked(useMacroBriefingPoll);

const BRIEFING: MacroBriefingResponse = {
    summary: '금리 동결 국면이에요.',
    highlights: ['고용 견조', '인플레이션 하향'],
    regime: 'recovery',
};

describe('MacroBriefing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('input=undefined → 로딩 스켈레톤(aria-busy)', () => {
        mockUseBriefing.mockReturnValue({ input: undefined });
        render(<MacroBriefing peekSeed={null} />);
        expect(
            screen.getByLabelText('거시 경제 브리핑 로딩 중')
        ).toBeInTheDocument();
    });

    it('input=null → 봇 차단 안내', () => {
        mockUseBriefing.mockReturnValue({ input: null });
        render(<MacroBriefing peekSeed={null} />);
        expect(
            screen.getByText('크롤러 접근으로 분석을 생성하지 않았어요.')
        ).toBeInTheDocument();
    });

    it("input='error' → 오류 inline notice (role=alert)", () => {
        mockUseBriefing.mockReturnValue({ input: 'error' });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '지금은 거시 브리핑을 만들지 못했어요.'
        );
    });

    it('input=cached → 브리핑 본문 + regime 배지', () => {
        mockUseBriefing.mockReturnValue({
            input: {
                status: 'cached',
                briefing: BRIEFING,
                generatedAt: '2026-06-17T00:00:00.000Z',
            },
        });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByText('금리 동결 국면이에요.')).toBeInTheDocument();
        // regime=recovery → 회복
        expect(screen.getByText('회복')).toBeInTheDocument();
        // highlights 렌더
        expect(screen.getByText('고용 견조')).toBeInTheDocument();
        expect(screen.getByText('인플레이션 하향')).toBeInTheDocument();
    });

    it('input=submitted → 폴링 위임: processing이면 스켈레톤', () => {
        mockUseBriefing.mockReturnValue({
            input: { status: 'submitted', jobId: 'job-1' },
        });
        mockUsePoll.mockReturnValue({ status: 'processing' });
        render(<MacroBriefing peekSeed={null} />);
        expect(
            screen.getByLabelText('거시 경제 브리핑 로딩 중')
        ).toBeInTheDocument();
        expect(mockUsePoll).toHaveBeenCalledWith('job-1');
    });

    it('input=submitted → 폴링 done이면 브리핑 본문 렌더', () => {
        mockUseBriefing.mockReturnValue({
            input: { status: 'submitted', jobId: 'job-1' },
        });
        mockUsePoll.mockReturnValue({
            status: 'done',
            briefing: BRIEFING,
            generatedAt: '2026-06-17T00:00:00.000Z',
        });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByText('금리 동결 국면이에요.')).toBeInTheDocument();
    });

    it('input=submitted → 폴링 error면 오류 inline notice', () => {
        mockUseBriefing.mockReturnValue({
            input: { status: 'submitted', jobId: 'job-1' },
        });
        mockUsePoll.mockReturnValue({
            status: 'error',
            error: 'worker boom',
        });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '지금은 거시 브리핑을 만들지 못했어요.'
        );
    });
});
