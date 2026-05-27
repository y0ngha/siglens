import { isClientRendering } from '@/shared/lib/isClientRendering';

describe('isClientRendering 함수는', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Node.js 테스트 환경에서는 false를 반환한다', () => {
        expect(isClientRendering()).toBe(false);
    });

    it('window가 있으면 true를 반환한다', () => {
        vi.stubGlobal('window', {});

        expect(isClientRendering()).toBe(true);
    });
});
