import { getTranslations } from 'next-intl/server';
import { describe, expect, it } from 'vitest';

import { MARKET_FEAR_GREED_LINK } from '@/app/[locale]/[symbol]/fear-greed/_lib/marketFearGreedLink';

describe('MARKET_FEAR_GREED_LINK', () => {
    it.each([
        ['us-equity', '/fear-greed'],
        ['kr-equity', '/fear-greed/kr'],
        ['crypto', '/fear-greed/crypto'],
    ] as const)('%s는 자기 시장 허브(%s)를 가리킨다', (profile, href) => {
        expect(MARKET_FEAR_GREED_LINK[profile].href).toBe(href);
    });

    it('문구는 URL 로케일의 카탈로그에서 나온다', async () => {
        const tEn = await getTranslations({
            locale: 'en',
            namespace: 'app.symbol',
        });
        const tKo = await getTranslations({
            locale: 'ko',
            namespace: 'app.symbol',
        });
        const link = MARKET_FEAR_GREED_LINK['kr-equity'];

        expect(link.marketLabel(tEn)).not.toMatch(/[가-힣]/);
        expect(link.label(tEn)).not.toMatch(/[가-힣]/);
        expect(link.marketLabel(tKo)).toMatch(/[가-힣]/);
    });
});
