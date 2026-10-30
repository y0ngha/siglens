import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { OperatorCard } from '../../ui/operator/OperatorCard';

const LINKS = [
    { href: 'mailto:someone@example.test', label: 'Mail me' },
    {
        href: 'https://github.com/someone',
        label: 'Profile',
        rel: 'me noopener',
        withGithubIcon: true,
    },
];

function renderCard() {
    renderWithIntl(
        <OperatorCard jobTitle="Builds it" body="Runs alone." links={LINKS} />
    );
}

describe('OperatorCard', () => {
    it('keeps the operator name and role apart in the page text', () => {
        renderCard();
        expect(
            screen.getByText(SITE_OPERATOR.name).parentElement!.textContent
        ).toBe(`${SITE_OPERATOR.name} Builds it`);
    });

    it('omits rel and the GitHub mark on a plain link', () => {
        renderCard();
        const mail = screen.getByRole('link', { name: 'Mail me' });
        expect(mail).toHaveAttribute('href', 'mailto:someone@example.test');
        expect(mail).not.toHaveAttribute('rel');
        expect(mail.querySelector('svg')).toBeNull();
    });

    it('draws the GitHub mark and keeps rel on the profile link', () => {
        renderCard();
        const profile = screen.getByRole('link', { name: 'Profile' });
        expect(profile).toHaveAttribute('rel', 'me noopener');
        expect(profile.querySelector('svg')).not.toBeNull();
    });
});
