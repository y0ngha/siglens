import { PwaBanner } from '@/features/pwa-install/ui/PwaBanner';
import { usePwaInstall } from '@/features/pwa-install/hooks/usePwaInstall';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/features/pwa-install/hooks/usePwaInstall');

const mockUsePwaInstall = vi.mocked(usePwaInstall);

describe('PwaBanner', () => {
    it('showBanner=true이면 같은 shell을 가시 상태로 렌더한다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        const shell = screen.getByTestId('pwa-banner-shell');
        // 하단 고정 오버레이 — 흐름에 끼어 본문을 밀지 않는다(CLS 0).
        expect(shell.className).toContain('fixed');
        expect(shell.className).toContain(
            'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'
        );
        // globals.css의 FAB 들어올림·시트 펼침 숨김 규칙이 이 속성을 본다.
        expect(shell).toHaveAttribute('data-pwa-banner');
        // 고정 오버레이는 이름 있는 region 랜드마크로 노출된다.
        expect(screen.getByRole('region', { name: '앱 설치 안내' })).toBe(
            shell
        );
        expect(
            screen.getByRole('button', { name: '설치하기' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '배너 닫기' })
        ).toBeInTheDocument();
    });

    it('닫기 버튼 클릭 → handleDismiss 호출', () => {
        const handleDismiss = vi.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss,
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        fireEvent.click(screen.getByRole('button', { name: '배너 닫기' }));
        expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('설치하기 버튼 클릭 → handleInstall 호출', () => {
        const handleInstall = vi.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall,
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        fireEvent.click(screen.getByRole('button', { name: '설치하기' }));
        expect(handleInstall).toHaveBeenCalledTimes(1);
    });

    it('showBanner=false이면 아무것도 렌더하지 않는다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: false,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        const { container } = render(<PwaBanner />);
        expect(container).toBeEmptyDOMElement();
    });

    /**
     * 회귀: 흐름 삽입 시절에는 `/[symbol]` jail이 배너 높이를 빼도록 루트에
     * `--pwa-banner-h`를 걸었다. 오버레이는 흐름 높이가 없으므로 어떤 레이아웃
     * 변수도 건드리지 않아야 한다.
     */
    it('배너가 떠도 루트에 레이아웃 보정 변수를 걸지 않는다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        expect(document.documentElement.getAttribute('style') ?? '').toBe('');
    });

    it('isIos=true && showIosModal=true → IosInstallModal 렌더', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: true,
            isIos: true,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
