vi.mock('@/widgets/economy/hooks/useMacroBriefing');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { MacroBriefing } from '@/widgets/economy/sections/MacroBriefing';
import { useMacroBriefing } from '@/widgets/economy/hooks/useMacroBriefing';

const mockUseBriefing = vi.mocked(useMacroBriefing);

const BRIEFING: MacroBriefingResponse = {
    summary: '금리 동결 국면이에요.',
    highlights: ['고용 견조', '인플레이션 하향'],
    regime: 'recovery',
};

const noop = vi.fn();

describe('MacroBriefing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('input=undefined → 로딩 스켈레톤(aria-busy)', () => {
        mockUseBriefing.mockReturnValue({ input: undefined, refetch: noop });
        render(<MacroBriefing peekSeed={null} />);
        expect(
            screen.getByLabelText('거시 경제 브리핑 로딩 중')
        ).toBeInTheDocument();
    });

    it('input=null → 봇 차단 안내', () => {
        mockUseBriefing.mockReturnValue({ input: null, refetch: noop });
        render(<MacroBriefing peekSeed={null} />);
        expect(
            screen.getByText('크롤러 접근으로 분석을 생성하지 않았어요.')
        ).toBeInTheDocument();
    });

    it("input='error' → 오류 inline notice (role=alert)", () => {
        mockUseBriefing.mockReturnValue({ input: 'error', refetch: noop });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '지금은 거시 브리핑을 만들지 못했어요.'
        );
    });

    it("input='error' → '다시 시도' 버튼 클릭 시 refetch 호출", () => {
        const refetch = vi.fn();
        mockUseBriefing.mockReturnValue({ input: 'error', refetch });
        render(<MacroBriefing peekSeed={null} />);
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('input=cached → 브리핑 본문 + regime 배지', () => {
        mockUseBriefing.mockReturnValue({
            input: {
                status: 'cached',
                briefing: BRIEFING,
                generatedAt: '2026-06-17T00:00:00.000Z',
            },
            refetch: noop,
        });
        render(<MacroBriefing peekSeed={null} />);
        expect(screen.getByText('금리 동결 국면이에요.')).toBeInTheDocument();
        // regime=recovery → 회복
        expect(screen.getByText('회복')).toBeInTheDocument();
        // highlights 렌더
        expect(screen.getByText('고용 견조')).toBeInTheDocument();
        expect(screen.getByText('인플레이션 하향')).toBeInTheDocument();
    });
});
