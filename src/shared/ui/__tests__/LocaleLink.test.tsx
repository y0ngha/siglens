vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));

// SymbolTabs.test.tsx의 next/link 목 패턴을 따르되, onClick에서 실제 next/link처럼
// `onNavigate`를 호출하도록 확장한다 — jsdom에서는 next/link 내부의 클라이언트
// 네비게이션 로직이 동작하지 않아 이 목 없이는 `onNavigate`가 전혀 불리지 않는다.
vi.mock('next/link', () => ({
    default: ({
        href,
        onNavigate,
        children,
        ...rest
    }: {
        href: string;
        onNavigate?: (event: { preventDefault: () => void }) => void;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a
            href={href}
            onClick={event => {
                onNavigate?.({ preventDefault: () => event.preventDefault() });
            }}
            {...rest}
        >
            {children}
        </a>
    ),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { LocaleLink } from '../LocaleLink';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import {
    NavigationPendingProvider,
    usePendingHref,
} from '@/shared/model/NavigationPendingContext';
import type { Locale } from '@/shared/i18n/locales';

const mockPathname = usePathname as ReturnType<typeof vi.fn>;

function PendingProbe() {
    const pendingHref = usePendingHref();
    return <span data-testid="pending">{pendingHref ?? 'none'}</span>;
}

function renderIn(locale: Locale, href: string, hrefBase?: string) {
    render(
        <LocaleProvider locale={locale} hrefBase={hrefBase}>
            <LocaleLink href={href}>go</LocaleLink>
        </LocaleProvider>
    );
    return screen.getByRole('link', { name: 'go' });
}

describe('LocaleLink', () => {
    it('기본 로케일은 접두사를 붙이지 않는다 — 기존 URL이 그대로여야 한다', () => {
        expect(renderIn('ko', '/market')).toHaveAttribute('href', '/market');
    });

    /**
     * 이게 없으면 `/en/AAPL`에서 내비를 한 번만 눌러도 ko로 떨어진다 —
     * 접두사 없는 경로는 프록시가 기본 로케일로 해석하기 때문이다.
     */
    it.each([
        ['en', '/en/market'],
        ['ja', '/ja/market'],
        ['zh', '/zh/market'],
    ] as const)('%s는 접두사를 붙인다', (locale, expected) => {
        expect(renderIn(locale, '/market')).toHaveAttribute('href', expected);
    });

    it('외부 URL은 손대지 않는다', () => {
        expect(
            renderIn('en', 'https://example.com/x' as string)
        ).toHaveAttribute('href', 'https://example.com/x');
    });

    it('앵커는 손대지 않는다', () => {
        expect(renderIn('ja', '#section')).toHaveAttribute('href', '#section');
    });

    /**
     * 프로바이더 없이도 던지지 않아야 한다 — 링크는 앱 전역에 있고, 조각 렌더
     * 테스트 수백 개가 프로바이더를 두르지 않는다.
     */
    it('프로바이더가 없으면 기본 로케일로 동작한다', () => {
        render(<LocaleLink href="/news">go</LocaleLink>);
        expect(screen.getByRole('link', { name: 'go' })).toHaveAttribute(
            'href',
            '/news'
        );
    });

    /**
     * ai.siglens.io는 `hrefBase`로 메인 사이트 origin을 흘려보낸다 — 헤더의
     * `/market`, `/login` 같은 내부 링크가 ai 호스트 안에 갇혀 404가 나지 않고
     * 메인 사이트로 나가야 한다.
     */
    it('hrefBase가 있으면 로케일 경로 앞에 origin을 붙인다', () => {
        expect(renderIn('en', '/market', 'https://siglens.io')).toHaveAttribute(
            'href',
            'https://siglens.io/en/market'
        );
    });

    it('hrefBase가 있어도 기본 로케일은 접두사를 붙이지 않는다', () => {
        expect(renderIn('ko', '/market', 'https://siglens.io')).toHaveAttribute(
            'href',
            'https://siglens.io/market'
        );
    });

    it('hrefBase가 없으면 상대 경로 그대로다(메인 호스트, 동작 불변)', () => {
        expect(renderIn('en', '/market')).toHaveAttribute('href', '/en/market');
    });

    it('hrefBase가 있어도 외부 URL은 손대지 않는다', () => {
        expect(
            renderIn('en', 'https://example.com/x', 'https://siglens.io')
        ).toHaveAttribute('href', 'https://example.com/x');
    });

    it('hrefBase가 있어도 앵커는 손대지 않는다', () => {
        expect(renderIn('en', '#top', 'https://siglens.io')).toHaveAttribute(
            'href',
            '#top'
        );
    });

    describe('클릭 시 전역 pending 상태', () => {
        beforeEach(() => {
            mockPathname.mockReturnValue('/market');
        });

        it('내부 링크를 클릭하면 호출부의 onNavigate를 부르고 전역 pending을 세운다', () => {
            const onNavigate = vi.fn();
            render(
                <LocaleProvider locale="ko">
                    <NavigationPendingProvider>
                        <LocaleLink href="/news" onNavigate={onNavigate}>
                            go
                        </LocaleLink>
                        <PendingProbe />
                    </NavigationPendingProvider>
                </LocaleProvider>
            );

            fireEvent.click(screen.getByRole('link', { name: 'go' }));

            expect(onNavigate).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('pending').textContent).toBe('/news');
        });

        it('호출부가 preventDefault하면 pending을 세우지 않고 원본 이벤트도 취소한다', () => {
            render(
                <LocaleProvider locale="ko">
                    <NavigationPendingProvider>
                        <LocaleLink
                            href="/news"
                            onNavigate={event => event.preventDefault()}
                        >
                            go
                        </LocaleLink>
                        <PendingProbe />
                    </NavigationPendingProvider>
                </LocaleProvider>
            );

            // fireEvent.click은 클릭 결과가 취소됐으면(preventDefault) false를 돌려준다
            // — 원본 이벤트의 preventDefault가 실제로 불렸는지 이 값으로 확인한다.
            const notPrevented = fireEvent.click(
                screen.getByRole('link', { name: 'go' })
            );

            expect(notPrevented).toBe(false);
            expect(screen.getByTestId('pending').textContent).toBe('none');
        });
    });
});
