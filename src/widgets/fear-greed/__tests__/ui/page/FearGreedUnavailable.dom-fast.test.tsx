import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { FearGreedUnavailable } from '@/widgets/fear-greed/ui/page/FearGreedUnavailable';

let t: Awaited<ReturnType<typeof getTranslations>>;
beforeAll(async () => {
    t = await getTranslations({
        locale: 'ko',
        namespace: 'widgets.fear-greed',
    });
});

describe('FearGreedUnavailable', () => {
    it('점수를 낼 수 없다는 안내와 이유를 적는다', () => {
        const { container } = render(<FearGreedUnavailable />);
        const paragraphs = Array.from(container.querySelectorAll('p')).map(
            p => p.textContent
        );
        expect(paragraphs).toEqual([
            t('FearGreedPage.d6e558'),
            t('FearGreedPage.ef5b22'),
        ]);
    });
});
