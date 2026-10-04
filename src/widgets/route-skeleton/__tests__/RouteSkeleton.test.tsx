import { render } from '@testing-library/react';
import type { RouteKind } from '@/shared/config/routeKind';
import { RouteSkeleton } from '../RouteSkeleton';

const KINDS = [
    'home',
    'market',
    'fearGreed',
    'economy',
    'news',
    'symbols',
    'backtesting',
    'article',
    'legal',
    'auth',
    'account',
    'portfolio',
    'share',
    'generic',
] as const satisfies readonly Exclude<RouteKind, 'symbol'>[];

describe('RouteSkeleton', () => {
    /**
     * 루트 슬롯은 목적지 라우트의 번역 메시지가 오기 전에 이 골격을 그린다. 그래서
     * `NextIntlClientProvider` 없이 렌더되고 글자가 하나도 없어야 한다 — 문구를
     * 넣으면 next-intl이 키 누락으로 던지거나 원문 키가 화면에 찍힌다.
     */
    it.each(KINDS)('%s: 프로바이더 없이 글자 없는 장식으로 그려진다', kind => {
        const { container } = render(<RouteSkeleton kind={kind} />);
        const root = container.firstElementChild as HTMLElement;

        expect(root.dataset.routeSkeleton).toBe(kind);
        expect(root.getAttribute('aria-hidden')).toBe('true');
        expect(root.textContent).toBe('');
        expect(root.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
            0
        );
    });

    it('움직임 줄이기 설정을 따른다', () => {
        const { container } = render(<RouteSkeleton kind="market" />);
        const pulsing = Array.from(
            container.querySelectorAll('.animate-pulse')
        );
        expect(
            pulsing.every(el =>
                el.className.includes('motion-reduce:animate-none')
            )
        ).toBe(true);
    });

    it('첫 화면을 채워 푸터를 끌어올리지 않는다', () => {
        const { container } = render(<RouteSkeleton kind="news" />);
        expect(
            (container.firstElementChild as HTMLElement).className
        ).toContain('min-h-[calc(100dvh-var(--header-h))]');
    });
});
