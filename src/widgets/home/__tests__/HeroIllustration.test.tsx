vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => (
        <span
            role="img"
            data-src={props.src as string}
            aria-label={props.alt as string}
            data-width={props.width as number}
            data-height={props.height as number}
            className={props.className as string}
            data-preload={String(props.preload)}
            data-legacy-priority={String(props.priority)}
            data-fetch-priority={props.fetchPriority as string}
        />
    ),
}));

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHART_COLORS_RAW_DARK } from '@/shared/lib/chartColors';
import koMessages from '../../../../messages/ko.json';
import { HeroIllustration } from '../HeroIllustration';

describe('HeroIllustration', () => {
    it('renders an image with the correct src', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('data-src', '/hero-levels-v3.svg');
    });

    it('has a descriptive alt text', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute(
            'aria-label',
            expect.stringContaining('캔들 차트')
        );
    });

    it('uses preload (not the deprecated priority) and fetchPriority for LCP optimization', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('data-preload', 'true');
        expect(img).toHaveAttribute('data-legacy-priority', 'undefined');
        expect(img).toHaveAttribute('data-fetch-priority', 'high');
    });

    it('applies the passed className', () => {
        render(<HeroIllustration className="custom-class" />);

        const img = screen.getByRole('img');
        expect(img).toHaveClass('custom-class');
    });

    it('대체 텍스트가 지지 구간·저항선·무효화 기준을 말한다', () => {
        render(<HeroIllustration />);

        const alt = koMessages.widgets.home.HeroIllustration.alt;
        expect(screen.getByRole('img')).toHaveAttribute('aria-label', alt);
        expect(alt).toContain('지지');
        expect(alt).toContain('저항선');
        expect(alt).toContain('무효화 기준');
    });

    describe('public/hero-levels-v3.svg', () => {
        const svg = readFileSync(
            join(process.cwd(), 'public/hero-levels-v3.svg'),
            'utf8'
        );
        // 캔들 그룹: 심지(line)와 몸통(rect)만 담긴 `<g stroke-linecap="round">` 블록.
        const candleGroup =
            /<g stroke-linecap="round">([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? '';

        it('상승 캔들은 실제 차트의 bullish 토큰, 하락 캔들은 bearish 토큰을 쓴다', () => {
            expect(candleGroup).toContain(CHART_COLORS_RAW_DARK.bullish);
            expect(candleGroup).toContain(CHART_COLORS_RAW_DARK.bearish);
        });

        it('캔들에 파란색(상승 색으로 쓰던 #3b82f6)을 쓰지 않는다', () => {
            expect(candleGroup).not.toMatch(/#3b82f6/i);
        });

        it('지지 띠는 supportLine, 저항선은 resistanceLine, 점선 무효화 기준은 actionStopLoss 색이다', () => {
            expect(svg).toMatch(
                new RegExp(
                    `<rect[^>]*fill="${CHART_COLORS_RAW_DARK.supportLine}"[^>]*fill-opacity`
                )
            );
            expect(svg).toMatch(
                new RegExp(
                    `<line[^>]*stroke="${CHART_COLORS_RAW_DARK.resistanceLine}"[^>]*stroke-width="2"/>`
                )
            );
            expect(svg).toMatch(
                new RegExp(
                    `<line[^>]*stroke="${CHART_COLORS_RAW_DARK.actionStopLoss}"[^>]*stroke-dasharray="10 8"/>`
                )
            );
        });

        /**
         * 지지 띠 가장자리 선과 띠 채움의 투명도. 패널(#1e293b~#0f172a) 위에서 가장자리 선은
         * 불투명도 1일 때 5.6:1(띠 위 4.4:1)이지만 0.7이면 띠 위 2.7:1로 3:1 아래라 1로 고정한다.
         * 띠 채움은 0.16을 넘기면 가장자리 선과의 대비가 3:1에 가까워진다.
         */
        it('지지 띠 가장자리 선은 불투명(1)이고 채움은 0.16 이하다', () => {
            const edges = [
                ...svg.matchAll(
                    new RegExp(
                        `<line[^>]*stroke="${CHART_COLORS_RAW_DARK.supportLine}"[^>]*stroke-opacity="([\\d.]+)"`,
                        'g'
                    )
                ),
            ];
            expect(edges).toHaveLength(2);
            expect(edges.every(match => match[1] === '1')).toBe(true);

            const fill = /<rect[^>]*fill-opacity="([\d.]+)"/.exec(svg)?.[1];
            expect(Number(fill)).toBeLessThanOrEqual(0.16);
        });

        it('지어낸 종목명·가격·등락률·지표 이름이 없다(글자 요소 없음)', () => {
            expect(svg).not.toMatch(/<text\b/);
            expect(svg).not.toMatch(/AAPL|GoldenCross|RSI|%/);
        });
    });
});
