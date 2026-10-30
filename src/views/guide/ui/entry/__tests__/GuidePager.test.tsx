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
    it('이전·다음 항목이 모두 없으면 아무것도 그리지 않는다', () => {
        const { container } = renderPager({ previous: null, next: null });
        expect(container.childElementCount).toBe(0);
    });

    it('내비게이션 랜드마크에 이름을 달고 양쪽 이웃 항목을 잇는다', () => {
        renderPager({ previous, next });
        const nav = screen.getByRole('navigation', { name: '항목 넘기기' });
        const links = Array.from(nav.querySelectorAll('a'));
        expect(links.map(link => link.textContent)).toEqual([
            '이전 글EMA 항목',
            '다음 글MACD 항목',
        ]);
    });

    it('이전 항목이 없어도 첫 칸을 비워 "다음"이 오른쪽에 남는다', () => {
        renderPager({ previous: null, next });
        const nav = screen.getByRole('navigation', { name: '항목 넘기기' });
        expect(nav.children).toHaveLength(2);
        expect(nav.children[0].tagName).toBe('SPAN');
        expect(nav.children[0].getAttribute('aria-hidden')).toBe('true');
        expect(nav.querySelectorAll('a')).toHaveLength(1);
    });
});
