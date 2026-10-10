import { isGuideEntryPath } from '../lib/staticPagePaths';

describe('isGuideEntryPath', () => {
    it('알려진 분류의 /guide/{category}/{slug} pathname을 항목으로 본다', () => {
        expect(isGuideEntryPath('/guide/candlesticks/doji')).toBe(true);
        expect(isGuideEntryPath('/guide/indicators/rsi')).toBe(true);
    });

    it('허브·분류 허브·모르는 분류·더 깊은 경로는 항목이 아니다', () => {
        expect(isGuideEntryPath('/guide')).toBe(false);
        expect(isGuideEntryPath('/guide/candlesticks')).toBe(false);
        expect(isGuideEntryPath('/guide/unknown/x')).toBe(false);
        expect(isGuideEntryPath('/guide/candlesticks/doji/extra')).toBe(false);
    });

    it('쿼리·해시가 섞인 값은 pathname이 아니므로 항목으로 보지 않는다', () => {
        expect(isGuideEntryPath('/guide/candlesticks/doji?x=1')).toBe(false);
        expect(isGuideEntryPath('/guide/candlesticks/doji#h')).toBe(false);
    });
});
