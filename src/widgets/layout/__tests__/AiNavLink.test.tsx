import { render, screen } from '@testing-library/react';
import { AiNavLink } from '../AiNavLink';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';

describe('AiNavLink', () => {
    it('ko href는 AI_SITE_URL + localePath(ko, "/")', () => {
        render(<AiNavLink />);

        const link = screen.getByRole('link', { name: 'SiglensAI' });
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

        const link = screen.getByRole('link', { name: 'SiglensAI' });
        expect(link).toHaveAttribute(
            'href',
            `${AI_SITE_URL}${localePath('en', '/')}`
        );
    });

    it('브랜드명은 번역기 대상에서 뺀다(translate="no")', () => {
        render(<AiNavLink />);

        expect(screen.getByRole('link', { name: 'SiglensAI' })).toHaveAttribute(
            'translate',
            'no'
        );
    });

    it('기본은 aria-current를 달지 않는다(메인 호스트)', () => {
        render(<AiNavLink />);

        expect(
            screen.getByRole('link', { name: 'SiglensAI' })
        ).not.toHaveAttribute('aria-current');
    });

    it('ai 호스트(hrefBase 설정)에서는 aria-current="page"', () => {
        render(
            <LocaleProvider locale="ko" hrefBase="https://siglens.io">
                <AiNavLink />
            </LocaleProvider>
        );

        expect(screen.getByRole('link', { name: 'SiglensAI' })).toHaveAttribute(
            'aria-current',
            'page'
        );
    });
});
