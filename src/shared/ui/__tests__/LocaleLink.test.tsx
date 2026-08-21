import { render, screen } from '@testing-library/react';
import { LocaleLink } from '../LocaleLink';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import type { Locale } from '@/shared/i18n/locales';

function renderIn(locale: Locale, href: string) {
    render(
        <LocaleProvider locale={locale}>
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
});
