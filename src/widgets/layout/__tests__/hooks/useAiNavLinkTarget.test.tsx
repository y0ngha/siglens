import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { useAiNavLinkTarget } from '../../hooks/useAiNavLinkTarget';

const withLocale =
    (locale: 'ko' | 'en', hrefBase?: string) =>
    ({ children }: { children: ReactNode }) => (
        <LocaleProvider locale={locale} hrefBase={hrefBase}>
            {children}
        </LocaleProvider>
    );

describe('useAiNavLinkTarget', () => {
    it('ko는 접두사 없는 ai 홈과 한글 제품명을 돌려준다', () => {
        const { result } = renderHook(() => useAiNavLinkTarget(), {
            wrapper: withLocale('ko'),
        });

        expect(result.current).toEqual({
            href: `${AI_SITE_URL}/`,
            brandLabel: '시그렌즈 AI',
            onAiHost: false,
        });
    });

    it('en은 로케일 접두사가 붙은 ai 홈과 영문 제품명을 돌려준다', () => {
        const { result } = renderHook(() => useAiNavLinkTarget(), {
            wrapper: withLocale('en'),
        });

        expect(result.current.href).toBe(`${AI_SITE_URL}/en`);
        expect(result.current.brandLabel).toBe('SIGLENS AI');
    });

    it('링크 기준이 설정된 ai 호스트에서는 onAiHost다', () => {
        const { result } = renderHook(() => useAiNavLinkTarget(), {
            wrapper: withLocale('ko', 'https://siglens.io'),
        });

        expect(result.current.onAiHost).toBe(true);
    });
});
