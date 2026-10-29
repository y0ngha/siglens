import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import { GuidePager } from '@/views/guide/ui/entry/GuidePager';

const previous = guideEntry({ slug: 'ema', title: 'EMA 항목' });
const next = guideEntry({ slug: 'macd', title: 'MACD 항목' });

function renderPager(
    neighbors: Pick<Parameters<typeof GuidePager>[0], 'previous' | 'next'>
) {
    return render(
        <GuidePager
            label="항목 넘기기"
            nextLabel="다음 글"
            previousLabel="이전 글"
            {...neighbors}
        />
    );
}

describe('GuidePager', () => {
    it('renders nothing when there is neither a previous nor a next entry', () => {
        const { container } = renderPager({ previous: null, next: null });
        expect(container.childElementCount).toBe(0);
    });

    it('names the navigation landmark and links both neighbours', () => {
        renderPager({ previous, next });
        const nav = screen.getByRole('navigation', { name: '항목 넘기기' });
        const links = Array.from(nav.querySelectorAll('a'));
        expect(links.map(link => link.textContent)).toEqual([
            '이전 글EMA 항목',
            '다음 글MACD 항목',
        ]);
    });

    it('keeps an empty first column so "next" stays on the right without a previous entry', () => {
        renderPager({ previous: null, next });
        const nav = screen.getByRole('navigation', { name: '항목 넘기기' });
        expect(nav.children).toHaveLength(2);
        expect(nav.children[0].tagName).toBe('SPAN');
        expect(nav.children[0].getAttribute('aria-hidden')).toBe('true');
        expect(nav.querySelectorAll('a')).toHaveLength(1);
    });
});
