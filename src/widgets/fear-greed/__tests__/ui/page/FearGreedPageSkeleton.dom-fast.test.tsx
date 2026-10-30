import { render, screen } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { FearGreedPageSkeleton } from '@/widgets/fear-greed/ui/page/FearGreedPageSkeleton';

let t: Awaited<ReturnType<typeof getTranslations>>;
beforeAll(async () => {
    t = await getTranslations({
        locale: 'ko',
        namespace: 'widgets.fear-greed',
    });
});

describe('FearGreedPageSkeleton', () => {
    it('로딩 중임을 이름 있는 status로 알린다', () => {
        render(<FearGreedPageSkeleton />);
        const status = screen.getByRole('status', {
            name: t('FearGreedPage.7da634'),
        });
        expect(status.getAttribute('aria-busy')).toBe('true');
    });

    it('본문과 같은 세 섹션에 자리 블록을 깔고 모션 감소 설정을 따른다', () => {
        const { container } = render(<FearGreedPageSkeleton />);
        expect(container.querySelectorAll('section')).toHaveLength(3);
        const blocks = container.querySelectorAll('.animate-pulse');
        expect(blocks).toHaveLength(7);
        for (const block of blocks) {
            expect(block.className).toContain('motion-reduce:animate-none');
        }
    });
});
