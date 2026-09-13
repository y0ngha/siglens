import { render, screen } from '@testing-library/react';
import { AiNavLink } from '../AiNavLink';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';

describe('AiNavLink', () => {
    it('ko href는 AI_SITE_URL + localePath(ko, "/")', () => {
        render(<AiNavLink />);

        const link = screen.getByRole('link', { name: 'SIGLENS AI Beta' });
        expect(link).toHaveAttribute(
            'href',
            `${AI_SITE_URL}${localePath('ko', '/')}`
        );
    });

    it('en href는 AI_SITE_URL + localePath(en, "/")', () => {
        render(
            <LocaleProvider locale="en">
                <AiNavLink />
            </LocaleProvider>
        );

        const link = screen.getByRole('link', { name: 'SIGLENS AI Beta' });
        expect(link).toHaveAttribute(
            'href',
            `${AI_SITE_URL}${localePath('en', '/')}`
        );
    });

    it('브랜드명은 번역기 대상에서 뺀다(translate="no")', () => {
        render(<AiNavLink />);

        expect(
            screen.getByRole('link', { name: 'SIGLENS AI Beta' })
        ).toHaveAttribute('translate', 'no');
    });

    it('기본은 aria-current를 달지 않는다(메인 호스트)', () => {
        render(<AiNavLink />);

        expect(
            screen.getByRole('link', { name: 'SIGLENS AI Beta' })
        ).not.toHaveAttribute('aria-current');
    });

    it('ai 호스트(hrefBase 설정)에서는 aria-current="page"', () => {
        render(
            <LocaleProvider locale="ko" hrefBase="https://siglens.io">
                <AiNavLink />
            </LocaleProvider>
        );

        expect(
            screen.getByRole('link', { name: 'SIGLENS AI Beta' })
        ).toHaveAttribute('aria-current', 'page');
    });

    describe('text variant (footer sitemap row)', () => {
        it('shows "SIGLENS AI" with no Beta badge and no aria-label override', () => {
            render(<AiNavLink variant="text" />);
            const link = screen.getByRole('link', { name: 'SIGLENS AI' });
            expect(link).toHaveTextContent('SIGLENS AI');
            expect(link).not.toHaveAttribute('aria-label');
            expect(link).toHaveAttribute(
                'href',
                `${AI_SITE_URL}${localePath('ko', '/')}`
            );
        });

        it('applies the given className', () => {
            render(<AiNavLink variant="text" className="my-class" />);
            expect(
                screen.getByRole('link', { name: 'SIGLENS AI' })
            ).toHaveClass('my-class');
        });
    });

    describe('wordmark variant (logo lockup)', () => {
        it('shows "AI" + the Beta tag but keeps the full accessible name and the ai href', () => {
            render(<AiNavLink variant="wordmark" />);
            const link = screen.getByRole('link', { name: 'SIGLENS AI Beta' });
            expect(link).toHaveTextContent(/^AIBeta$/);
            expect(link).toHaveAttribute('translate', 'no');
            expect(link).toHaveAttribute(
                'href',
                `${AI_SITE_URL}${localePath('ko', '/')}`
            );
            expect(link).not.toHaveAttribute('aria-current');
            expect(link.className).toMatch(/font-mono/);
        });

        it('is the current page on the ai host', () => {
            render(
                <LocaleProvider locale="ko" hrefBase="https://siglens.io">
                    <AiNavLink variant="wordmark" />
                </LocaleProvider>
            );
            expect(
                screen.getByRole('link', { name: 'SIGLENS AI Beta' })
            ).toHaveAttribute('aria-current', 'page');
        });
    });
});
