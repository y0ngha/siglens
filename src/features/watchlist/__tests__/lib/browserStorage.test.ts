// @vitest-environment jsdom
import { getDefaultLocalStorage } from '@/features/watchlist/lib/browserStorage';

describe('getDefaultLocalStorage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('브라우저에서는 window.localStorage를 돌려준다', () => {
        expect(getDefaultLocalStorage()).toBe(window.localStorage);
    });

    it('localStorage getter가 던지면(사이트 데이터 차단) null', () => {
        vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        expect(getDefaultLocalStorage()).toBeNull();
    });
});
