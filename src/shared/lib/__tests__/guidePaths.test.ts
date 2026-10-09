import {
    GUIDE_PATH,
    guideCategoryPath,
    guideEntryPath,
} from '@/shared/lib/guidePaths';

describe('guidePaths', () => {
    it('허브 경로는 /guide다', () => {
        expect(GUIDE_PATH).toBe('/guide');
    });

    it('카테고리 경로를 만든다', () => {
        expect(guideCategoryPath('indicators')).toBe('/guide/indicators');
    });

    it('항목 경로를 만든다', () => {
        expect(guideEntryPath('indicators', 'rsi')).toBe(
            '/guide/indicators/rsi'
        );
    });
});
