// release-it 경유 실행 시 `.env.local`의 NEXT_PUBLIC_SITE_URL(=dev URL)이 부모 프로세스에
// 주입되어 home 엔트리 URL이 'http://localhost:4200'(`siglens.io$` 정규식 미매치)으로
// 평가될 수 있다. production URL 회귀가드 의도 보존을 위해 import 평가 전에 강제 세팅한다.
//
// 이 패턴의 안전성은 ts-jest의 CommonJS transform에 의존한다 — ES `import`가 `require()`로
// lowering되어 코드 순서대로 평가되므로, 이 줄이 `@/lib/seo` evaluation 전에 실행된다.
// Babel 전환·`isolatedModules`+ESM output으로 바꾸면 import hoisting이 깨질 수 있으니
// 그때는 jest.mock 패턴으로 옮겨야 한다.
process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.io';

import { buildStaticEntries } from '../lib/buildStaticEntries';
import { MS_PER_HOUR } from '@/shared/config/time';

const NOW = new Date('2026-05-23T15:30:00.000Z');

describe('buildStaticEntries', () => {
    it('home / market / backtesting / privacy / terms 5개 엔트리를 반환한다', () => {
        const entries = buildStaticEntries(NOW);
        expect(entries).toHaveLength(5);

        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/\/$|siglens\.io$/), // home
                expect.stringContaining('/market'),
                expect.stringContaining('/backtesting'),
                expect.stringContaining('/privacy'),
                expect.stringContaining('/terms'),
            ])
        );
    });

    it('/market은 1시간 슬라이딩 lastmod를 적용한다', () => {
        const entries = buildStaticEntries(NOW);
        const market = entries.find(e => e.url.endsWith('/market'));
        expect(market).toBeDefined();
        expect(market!.lastModified.getTime()).toBe(
            NOW.getTime() - MS_PER_HOUR
        );
        expect(market!.changeFrequency).toBe('hourly');
    });

    it('home은 priority 1.0, monthly로 둔다', () => {
        const entries = buildStaticEntries(NOW);
        const home = entries[0];
        expect(home.priority).toBe(1);
        expect(home.changeFrequency).toBe('monthly');
    });

    it('legal 페이지는 yearly, priority 0.3', () => {
        const entries = buildStaticEntries(NOW);
        const legal = entries.filter(
            e => e.url.includes('/privacy') || e.url.includes('/terms')
        );
        expect(legal).toHaveLength(2);
        for (const entry of legal) {
            expect(entry.changeFrequency).toBe('yearly');
            expect(entry.priority).toBe(0.3);
        }
    });
});
