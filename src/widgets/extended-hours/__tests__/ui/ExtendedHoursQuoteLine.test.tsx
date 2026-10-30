vi.mock('@/entities/extended-hours/hooks/useExtendedHoursQuote', () => ({
    useExtendedHoursQuote: vi.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import { ExtendedHoursQuoteLine } from '@/widgets/extended-hours/ui/ExtendedHoursQuoteLine';
import { koMessage } from '@/shared/test-utils/koMessage';
import {
    AFTER_DOWN,
    PRE_FLAT,
    PRE_UP,
} from '@/widgets/extended-hours/__tests__/fixtures/extendedHoursQuotes';

const mockedHook = vi.mocked(useExtendedHoursQuote);

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

        it('보이는 줄은 세션 라벨·가격·등락(금액·%)뿐이다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line).toHaveTextContent(
                koMessage('widgets.extended-hours.sessionPre')
            );
            expect(line).toHaveTextContent('$346.38');
            expect(line).toHaveTextContent('+$3.42');
            expect(line).toHaveTextContent('+1.00%');
            expect(line).not.toHaveTextContent(
                koMessage('widgets.extended-hours.sessionAfter')
            );
        });

        it('체결 시각은 줄에서 빼고 ⓘ 툴팁 안으로 옮긴다(보이는 문구에 "ET 체결"이 없다)', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            const text = screen.getByTestId('extended-hours-text');
            const visible = Array.from(text.childNodes)
                .filter(
                    node =>
                        !(
                            node instanceof HTMLElement &&
                            node.classList.contains('sr-only')
                        )
                )
                .map(node => node.textContent)
                .join('');
            expect(visible).not.toContain('ET');
            expect(visible).not.toContain(
                koMessage('widgets.extended-hours.basisPre')
            );
            expect(line).not.toHaveAttribute('title');

            const trigger = line.querySelector('button');
            expect(trigger).not.toBeNull();
            fireEvent.click(trigger as Element);
            const tip = screen.getByRole('tooltip');
            expect(tip).toHaveTextContent(
                koMessage('widgets.extended-hours.basisPre')
            );
            expect(tip).toHaveTextContent('07:07 ET');
        });

        it('칩이 아니라 텍스트 캡션이다 — 테두리·배경·둥근 모서리가 없다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line.className).not.toMatch(
                /(^|\s)(border|bg-|rounded|px-|py-)/
            );
            expect(line).toHaveClass('text-xs', 'tabular-nums');
            // 한글+숫자가 섞인 줄이라 모노 서체를 걸지 않는다(DESIGN.md 문구 규약).
            expect(line.innerHTML).not.toContain('font-mono');
        });

        it('기준(전일 종가 대비)이 sr-only로 캡션 맨 앞에 온다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            const first = screen.getByTestId(
                'extended-hours-text'
            ).firstElementChild;
            expect(first).toHaveClass('sr-only');
            expect(first).toHaveTextContent(
                koMessage('widgets.extended-hours.basisPre')
            );
            expect(line).not.toHaveAttribute('title');
        });

        it('모든 화면 폭에서 같은 ⓘ 툴팁 버튼을 준다(sm에서 숨기지 않는다)', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const trigger = screen
                .getByTestId('extended-hours-quote')
                .querySelector('button');
            expect(trigger).not.toBeNull();
            expect(trigger?.parentElement?.className ?? '').not.toContain(
                'sm:hidden'
            );
            expect(trigger?.closest('.sm\\:hidden')).toBeNull();
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
        });

        it('기준은 오늘 종가 대비이고(툴팁에 체결 시각과 함께) 하락 단어를 전한다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(
                screen.getByTestId('extended-hours-text').firstElementChild
            ).toHaveTextContent(koMessage('widgets.extended-hours.basisAfter'));
            fireEvent.click(line.querySelector('button') as Element);
            const tip = screen.getByRole('tooltip');
            expect(tip).toHaveTextContent(
                koMessage('widgets.extended-hours.basisAfter')
            );
            expect(tip).toHaveTextContent('16:55 ET');
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

    describe('보합(등락 0)', () => {
        beforeEach(() => mockedHook.mockReturnValue(PRE_FLAT));

        it('상승으로 칠하지 않는다 — 화살표·부호·방향색 없이 보합 단어를 전한다', () => {
            render(<ExtendedHoursQuoteLine symbol="AAPL" />);

            const line = screen.getByTestId('extended-hours-quote');
            expect(line).toHaveTextContent('$342.96');
            expect(line).toHaveTextContent('$0.00 0.00%');
            expect(line).not.toHaveTextContent('+');
            expect(line).not.toHaveTextContent('▲');
            expect(
                screen.getByText(koMessage('widgets.extended-hours.flat'))
            ).toHaveClass('sr-only');
            expect(
                screen.queryByText(koMessage('shared.lib.priceMove.up'))
            ).toBeNull();
            expect(screen.getByTestId('extended-hours-move')).not.toHaveClass(
                'text-ui-success-text'
            );
        });
    });

    it('흐름을 밀지 않도록 글줄만 말줄임하고, ⓘ는 줄어들지 않는 형제다', () => {
        mockedHook.mockReturnValue(PRE_UP);

        render(<ExtendedHoursQuoteLine symbol="AAPL" />);

        const line = screen.getByTestId('extended-hours-quote');
        expect(line).toHaveClass(
            'max-w-full',
            'items-center',
            '@min-[9rem]:flex'
        );
        const text = screen.getByTestId('extended-hours-text');
        expect(text).toHaveClass('min-w-0', 'truncate');
        const button = line.querySelector('button');
        expect(button).not.toBeNull();
        // ⓘ는 말줄임하는 글줄 밖에 있다(overflow:hidden에 잘리지 않는다).
        expect(text.contains(button)).toBe(false);
        expect(button?.closest('.shrink-0')).not.toBeNull();
    });
});
