import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import {
    patternTitlesByPath,
    resolveDemoSource,
} from '@/views/guide/lib/guideEntry';

const RSI = guideEntry({ slug: 'rsi', title: 'RSI' });
const DOUBLE_BOTTOM = guideEntry({
    slug: 'double-bottom',
    category: 'chart-patterns',
    title: '이중바닥',
});

describe('resolveDemoSource', () => {
    it('demoFrom이 없으면 자기 자신이다', () => {
        expect(resolveDemoSource(RSI, [RSI])).toBe(RSI);
    });

    it('howto는 demoFrom이 가리키는 항목의 데모를 빌린다', () => {
        const howto = guideEntry({
            slug: 'rsi-how-to-read',
            category: 'howto',
            demoFrom: 'rsi',
        });
        expect(resolveDemoSource(howto, [howto, RSI])).toBe(RSI);
    });

    it('가리킨 항목이 카탈로그에 없으면 자기 자신으로 돌아온다', () => {
        const howto = guideEntry({
            slug: 'ghost-how-to',
            category: 'howto',
            demoFrom: 'ghost',
        });
        expect(resolveDemoSource(howto, [howto, RSI])).toBe(howto);
    });
});

describe('patternTitlesByPath', () => {
    it('차트 패턴 항목만 가이드 경로 → 제목으로 싣는다', () => {
        expect(patternTitlesByPath([RSI, DOUBLE_BOTTOM])).toEqual({
            '/guide/chart-patterns/double-bottom': '이중바닥',
        });
    });
});
