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

    describe('로딩 스켈레톤의 자리 예약', () => {
        function renderSkeleton(): HTMLElement {
            mockUseBriefing.mockReturnValue({
                input: undefined,
                refetch: noop,
            });
            render(<MacroBriefing peekSeed={null} />);
            return screen.getByLabelText('거시 경제 브리핑 로딩 중');
        }

        it('추정 카드 높이(min-h-72)를 미리 잡는다', () => {
            expect(renderSkeleton()).toHaveClass('min-h-72');
        });

        it('최종 카드처럼 요약 4줄·하이라이트 3줄·생성 시각 줄의 골격을 그린다', () => {
            const skeleton = renderSkeleton();
            // 요약 문단 줄(text-base leading-relaxed = 26px)
            expect(skeleton.querySelectorAll('.h-6\\.5')).toHaveLength(4);
            // 하이라이트 항목(불릿 점 + 줄)
            expect(skeleton.querySelectorAll('.rounded-full')).toHaveLength(3);
            // 생성 시각 줄
            expect(skeleton.querySelectorAll('.mt-3')).toHaveLength(1);
        });

        it('스켈레톤에는 텍스트가 없다(스크린리더는 aria-label만 읽는다)', () => {
            expect(renderSkeleton().textContent).toBe('');
        });
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

    it('seed로 그린 브리핑도 서버가 읽은 생성 시각을 보여 준다', () => {
        mockUseBriefing.mockReturnValue({
            input: {
                status: 'cached',
                briefing: BRIEFING,
                generatedAt: '2026-10-05T03:20:00.000Z',
            },
            refetch: noop,
        });
        render(
            <MacroBriefing
                peekSeed={{
                    briefing: BRIEFING,
                    generatedAt: '2026-10-05T03:20:00.000Z',
                }}
            />
        );
        expect(screen.getByText(/생성 시각:/)).toBeInTheDocument();
    });

    it('생성 시각을 모르는 옛 seed는 생성 시각 줄을 그리지 않는다', () => {
        mockUseBriefing.mockReturnValue({
            input: {
                status: 'cached',
                briefing: BRIEFING,
                generatedAt: null,
            },
            refetch: noop,
        });
        render(
            <MacroBriefing
                peekSeed={{ briefing: BRIEFING, generatedAt: null }}
            />
        );
        expect(screen.queryByText(/생성 시각:/)).not.toBeInTheDocument();
    });
});
