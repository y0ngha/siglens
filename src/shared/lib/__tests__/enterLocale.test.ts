const { mockSetRequestLocale } = vi.hoisted(() => ({
    mockSetRequestLocale: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
    setRequestLocale: mockSetRequestLocale,
}));

import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';

describe('enterLocale', () => {
    beforeEach(() => {
        mockSetRequestLocale.mockReset();
    });

    it('URL 세그먼트 원본으로 요청 로케일을 등록하고 검증된 로케일을 돌려준다', () => {
        expect(enterLocale('en')).toBe('en');
        expect(mockSetRequestLocale).toHaveBeenCalledWith('en');
    });

    it('알 수 없는 세그먼트는 기본 로케일로 돌려준다(등록은 원본 그대로)', () => {
        expect(enterLocale('xx')).toBe(DEFAULT_LOCALE);
        expect(mockSetRequestLocale).toHaveBeenCalledWith('xx');
    });
});
