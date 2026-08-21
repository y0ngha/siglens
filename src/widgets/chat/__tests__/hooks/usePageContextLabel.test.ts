// @vitest-environment jsdom
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(),
}));
// `@/entities/chat-message`의 `deriveLabelKey`는 mock하지 않는다 — 순수 함수이고,
// 로컬 재구현은 프로덕션과 갈라져도 테스트가 통과한다. 실제로 이전 mock은
// 앵커드 정규식 대신 `.includes()`를 써서 **프로덕션보다 관대**했고, 로케일
// 접두사가 붙은 경로에서 라벨이 null이 되는 회귀를 구조적으로 가리고 있었다.

import { renderHook } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';

import { usePageContextLabel } from '../../hooks/usePageContextLabel';

describe('usePageContextLabel', () => {
    it('returns a label for a symbol news page', () => {
        vi.mocked(usePathname).mockReturnValue('/AAPL/news');
        const { result } = renderHook(() => usePageContextLabel(), {
            wrapper: IntlTestProvider,
        });

        expect(result.current).toBe('뉴스 분석');
    });

    it('returns a label for a symbol chart page', () => {
        vi.mocked(usePathname).mockReturnValue('/AAPL');
        const { result } = renderHook(() => usePageContextLabel(), {
            wrapper: IntlTestProvider,
        });

        expect(result.current).toBe('차트 분석');
    });

    it('returns null for a non-symbol page', () => {
        vi.mocked(usePathname).mockReturnValue('/');
        const { result } = renderHook(() => usePageContextLabel(), {
            wrapper: IntlTestProvider,
        });

        expect(result.current).toBeNull();
    });
});

describe('usePageContextLabel — 로케일 접두사', () => {
    /**
     * `derivePageContextLabel`의 정규식은 `^/SYMBOL(/subpage)?$`로 앵커돼 있다.
     * 접두사를 떼지 않으면 비-ko 사용자의 챗은 페이지 컨텍스트를 영영 못 받는다.
     */
    it.each([
        ['/en/AAPL', '차트 분석'],
        ['/ja/AAPL/news', '뉴스 분석'],
        ['/zh/AAPL/fundamental', '펀더멘털 분석'],
    ])('%s → %s', (pathname, expected) => {
        vi.mocked(usePathname).mockReturnValue(pathname);
        const { result } = renderHook(() => usePageContextLabel(), {
            wrapper: IntlTestProvider,
        });
        expect(result.current).toBe(expected);
    });
});
