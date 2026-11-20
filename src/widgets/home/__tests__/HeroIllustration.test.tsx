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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { CHART_COLORS_RAW_DARK } from '@/shared/lib/chartColors';

import { HeroIllustration } from '../HeroIllustration';

describe('HeroIllustration', () => {
    it('renders an image with the correct src', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('data-src', '/hero-dashboard-v2.svg');
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

    describe('public/hero-dashboard-v2.svg 캔들 색', () => {
        const svg = readFileSync(
            join(process.cwd(), 'public/hero-dashboard-v2.svg'),
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
    });
});
