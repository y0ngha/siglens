import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import type { Locale } from '@/shared/i18n/locales';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { __resetHumanInteractionForTests } from '@/shared/lib/humanInteractionStore';

const { mockUseSymbolModel } = vi.hoisted(() => ({
    mockUseSymbolModel: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

describe('useAiAutoRunAllowed', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        __resetHumanInteractionForTests();
        mockUseSymbolModel.mockReturnValue({
            tier: 'free',
            isTierHydrated: true,
        });
    });

    it('큐레이션 종목은 입력 없이도 허용한다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('AAPL'));
        expect(result.current.allowed).toBe(true);
    });

    /**
     * 2026-10 비용 감사 M4: 종목 페이지는 `ko`만 색인된다. 큐레이션 종목이라도 비색인
     * 로케일에서 자동 생성하면 noindex 페이지를 렌더하는 크롤러마다 분석·평이화가 과금됐다.
     */
    it.each<Locale>(['en', 'ja', 'zh'])(
        '큐레이션 종목이라도 비색인 로케일(%s)에서는 입력 전까지 허용하지 않는다',
        locale => {
            const wrapper = ({ children }: { children: ReactNode }) => (
                <LocaleProvider locale={locale}>{children}</LocaleProvider>
            );
            const { result } = renderHook(() => useAiAutoRunAllowed('AAPL'), {
                wrapper,
            });
            expect(result.current.allowed).toBe(false);
        }
    );

    it('색인 로케일(ko)의 큐레이션 종목은 허용한다', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <LocaleProvider locale="ko">{children}</LocaleProvider>
        );
        const { result } = renderHook(() => useAiAutoRunAllowed('AAPL'), {
            wrapper,
        });
        expect(result.current.allowed).toBe(true);
    });

    it('비색인 로케일에서도 회원·입력 경로는 그대로 허용한다', () => {
        mockUseSymbolModel.mockReturnValue({
            tier: 'member',
            isTierHydrated: true,
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <LocaleProvider locale="en">{children}</LocaleProvider>
        );
        const { result } = renderHook(() => useAiAutoRunAllowed('AAPL'), {
            wrapper,
        });
        expect(result.current.allowed).toBe(true);
    });

    it('비회원의 롱테일 종목은 입력 전까지 허용하지 않는다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(false);
    });

    it('회원은 롱테일 종목도 허용한다', () => {
        mockUseSymbolModel.mockReturnValue({
            tier: 'member',
            isTierHydrated: true,
        });
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(true);
    });

    it('tier가 확정되기 전에는 회원으로 보지 않는다', () => {
        mockUseSymbolModel.mockReturnValue({
            tier: 'member',
            isTierHydrated: false,
        });
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(false);
    });

    it('grant를 부르면 허용으로 바뀐다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        act(() => {
            result.current.grant();
        });
        expect(result.current.allowed).toBe(true);
    });
});
