import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationGroup } from '@/widgets/agent-chat/sidebar/ConversationGroup';

describe('ConversationGroup', () => {
    it('renders the label and its rows', () => {
        render(
            <ConversationGroup label="Today">
                <li>row one</li>
            </ConversationGroup>
        );
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('row one')).toBeInTheDocument();
    });

    it('labels the section by its heading', () => {
        render(
            <ConversationGroup label="Today">
                <li>row one</li>
            </ConversationGroup>
        );
        expect(screen.getByRole('region', { name: 'Today' })).toBeVisible();
    });

    it('gives each instance its own heading id', () => {
        render(
            <>
                <ConversationGroup label="Today">
                    <li>a</li>
                </ConversationGroup>
                <ConversationGroup label="Yesterday">
                    <li>b</li>
                </ConversationGroup>
            </>
        );
        const todayId = screen.getByText('Today').id;
        const yesterdayId = screen.getByText('Yesterday').id;
        expect(todayId).not.toBe('');
        expect(todayId).not.toBe(yesterdayId);
    });

    it('points each section at its own heading even with identical labels', () => {
        const { container } = render(
            <>
                <ConversationGroup label="Same">
                    <li>a</li>
                </ConversationGroup>
                <ConversationGroup label="Same">
                    <li>b</li>
                </ConversationGroup>
            </>
        );
        const sections = container.querySelectorAll('section');
        const ids = Array.from(sections).map(s =>
            s.getAttribute('aria-labelledby')
        );
        expect(ids[0]).not.toBe(ids[1]);
        for (const section of sections) {
            const id = section.getAttribute('aria-labelledby') as string;
            expect(section.querySelector(`[id="${id}"]`)).toHaveTextContent(
                'Same'
            );
        }
    });
});
