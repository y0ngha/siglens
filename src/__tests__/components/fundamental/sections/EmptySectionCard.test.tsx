/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EmptySectionCard } from '@/components/fundamental/sections/EmptySectionCard';

describe('EmptySectionCard', () => {
    it('renders title with provided headingClassName and the shared empty message', () => {
        render(
            <EmptySectionCard
                headingId="test-heading"
                title="테스트 섹션"
                headingClassName="mb-4 text-lg font-semibold tracking-tight"
            />
        );
        const heading = screen.getByRole('heading', { name: '테스트 섹션' });
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveAttribute('id', 'test-heading');
        expect(heading).toHaveClass(
            'mb-4',
            'text-lg',
            'font-semibold',
            'tracking-tight'
        );
        expect(
            screen.getByText('데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('links section aria-labelledby to the heading id', () => {
        const { container } = render(
            <EmptySectionCard
                headingId="profile-heading"
                title="회사 프로필"
                headingClassName="text-xl font-semibold tracking-tight"
            />
        );
        const section = container.querySelector('section');
        expect(section).toHaveAttribute('aria-labelledby', 'profile-heading');
    });

    it('renders children after the empty message (slot composition)', () => {
        render(
            <EmptySectionCard
                headingId="profile-heading"
                title="회사 프로필"
                headingClassName="text-xl font-semibold tracking-tight"
            >
                <p data-testid="slot">슬롯</p>
            </EmptySectionCard>
        );
        expect(screen.getByTestId('slot')).toBeInTheDocument();
    });
});
