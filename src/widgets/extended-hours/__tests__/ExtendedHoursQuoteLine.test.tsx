vi.mock('@/entities/extended-hours/hooks/useExtendedHoursQuote', () => ({
    useExtendedHoursQuote: vi.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import type { ExtendedHoursQuote } from '@/entities/extended-hours/model';
import { ExtendedHoursQuoteLine } from '@/widgets/extended-hours/ui/ExtendedHoursQuoteLine';
import { koMessage } from '@/shared/test-utils/koMessage';

const mockedHook = vi.mocked(useExtendedHoursQuote);

/** 라이브 프로브 값: AAPL 프리마켓 346.38, 직전 종가 342.96, 07:07:12 ET. */
const PRE_UP: ExtendedHoursQuote = {
    session: 'pre-market',
    price: 346.38,
    referenceClose: 342.96,
    change: 3.42,
    changePercent: (3.42 / 342.96) * 100,
    tradedAtMs: 1792062432000,
};

const AFTER_DOWN: ExtendedHoursQuote = {
    session: 'after-hours',
    price: 348.25,
    referenceClose: 350,
    change: -1.75,
    changePercent: -0.5,
    tradedAtMs: Date.UTC(2026, 9, 15, 20, 55), // 16:55 EDT
};

describe('ExtendedHoursQuoteLine', () => {
    beforeEach(() => {
        mockedHook.mockReset();
    });

    describe('값이 없으면 아무것도 그리지 않는다', () => {
        it('훅이 null이면(세션 밖·E2E·키 없음·장애) DOM이 비어 있다', () => {
            mockedHook.mockReturnValue(null);

            const { container } = render(
                <ExtendedHoursQuoteLine symbol="AAPL" />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('훅에는 받은 심볼을 그대로 넘긴다', () => {
            mockedHook.mockReturnValue(null);

            render(<ExtendedHoursQuoteLine symbol="MSFT" />);

            expect(mockedHook).toHaveBeenCalledWith('MSFT');
        });
    });

    describe('프리마켓 상승', () => {
        beforeEach(() => mockedHook.mockReturnValue(PRE_UP));

        it('라벨·가격·등락률·체결 시각을 보여 준다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line).toHaveTextContent(
                koMessage('widgets.extended-hours.sessionPre')
            );
            expect(line).toHaveTextContent('$346.38');
            expect(line).toHaveTextContent('+$3.42');
            expect(line).toHaveTextContent('+1.00%');
            expect(line).toHaveTextContent('07:07 ET');
            expect(line).not.toHaveTextContent(
                koMessage('widgets.extended-hours.sessionAfter')
            );
        });

        it('기준(전일 종가 대비)이 sr-only로 알약 맨 앞에 오고, sm 이상에서는 보이는 라벨로도 있다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            const basis = koMessage('widgets.extended-hours.basisPre');
            const first = line.firstElementChild;
            expect(first).toHaveClass('sr-only');
            expect(first).toHaveTextContent(basis);
            const visible = screen.getByTestId('extended-hours-basis');
            expect(visible).toHaveTextContent(basis);
            expect(visible).toHaveClass('hidden', 'sm:inline');
            expect(line).not.toHaveAttribute('title');
        });

        it('sm 미만(터치)에는 같은 기준을 ⓘ 툴팁 버튼으로 준다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const trigger = screen
                .getByTestId('extended-hours-quote')
                .querySelector('.sm\\:hidden button');
            expect(trigger).not.toBeNull();
            fireEvent.click(trigger as Element);
            expect(screen.getByRole('tooltip')).toHaveTextContent(
                koMessage('widgets.extended-hours.basisPre')
            );
        });

        it('방향 단어(상승)를 화살표 옆 sr-only로 전한다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            expect(
                screen.getByText(koMessage('shared.lib.priceMove.up'))
            ).toHaveClass('sr-only');
        });

        it('상승은 success 시맨틱 텍스트 토큰과 ▲를 쓴다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const arrow = screen.getByText('▲');
            expect(arrow).toHaveAttribute('aria-hidden', 'true');
            expect(arrow.parentElement).toHaveClass('text-ui-success-text');
        });
    });

    describe('애프터마켓 하락', () => {
        beforeEach(() => mockedHook.mockReturnValue(AFTER_DOWN));

        it('애프터마켓 라벨과 하락 부호·금액을 보여 준다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line).toHaveTextContent(
                koMessage('widgets.extended-hours.sessionAfter')
            );
            expect(line).toHaveTextContent('$348.25');
            expect(line).toHaveTextContent('-$1.75');
            expect(line).toHaveTextContent('-0.50%');
            expect(line).toHaveTextContent('16:55 ET');
        });

        it('기준은 오늘 종가 대비이고 하락 단어를 전한다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line.firstElementChild).toHaveTextContent(
                koMessage('widgets.extended-hours.basisAfter')
            );
            expect(
                screen.getByTestId('extended-hours-basis')
            ).toHaveTextContent(koMessage('widgets.extended-hours.basisAfter'));
            expect(
                screen.getByText(koMessage('shared.lib.priceMove.down'))
            ).toHaveClass('sr-only');
        });

        it('하락은 danger 시맨틱 텍스트 토큰과 ▼를 쓴다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            expect(screen.getByText('▼').parentElement).toHaveClass(
                'text-ui-danger-text'
            );
        });
    });

    it('흐름을 밀지 않도록 한 줄 말줄임 알약이고, 알약만 포인터를 받는다', () => {
        mockedHook.mockReturnValue(PRE_UP);

        render(<ExtendedHoursQuoteLine symbol="AAPL" />);

        const line = screen.getByTestId('extended-hours-quote');
        expect(line).toHaveClass(
            'truncate',
            'max-w-full',
            'pointer-events-auto',
            '@min-[9rem]:block'
        );
    });
});
