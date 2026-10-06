import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { SymbolLayoutHeader } from '@/views/symbol/SymbolLayoutHeader';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const CRUMB_PROPS = {
    breadcrumbLabel: '이동 경로',
    tabCrumbLabels: {
        news: '뉴스',
        fundamental: '펀더멘털',
        financials: '재무제표',
        congress: '의회 거래',
        options: '옵션',
        'fear-greed': '공포 탐욕 지수',
        overall: '종합',
        position: '내 위치',
    },
} as const;

const mockSegment = vi.hoisted(() => ({ current: null as string | null }));
vi.mock('next/navigation', async importOriginal => ({
    ...(await importOriginal<typeof import('next/navigation')>()),
    useSelectedLayoutSegment: () => mockSegment.current,
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => ({
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    })),
}));

const { mockUseSymbolModel, mockOpenSignupNudge } = vi.hoisted(() => ({
    mockOpenSignupNudge: vi.fn(),
    mockUseSymbolModel: vi.fn(),
}));

// The provider (not the header) owns and renders the single signup-nudge modal.
// The header only calls the shared `openSignupNudge` from context on a locked
// toggle click, so these tests assert on that opener, not on a rendered modal.
function symbolModelValue(overrides: Record<string, unknown> = {}) {
    return {
        modelId: 'gemini-3.5-flash-lite',
        allowedModels: ['gemini-3.5-flash-lite'],
        isHydrated: true,
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: vi.fn(),
        reasoning: false,
        setReasoning: vi.fn(),
        canUseReasoning: false,
        openSignupNudge: mockOpenSignupNudge,
        ...overrides,
    };
}

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

vi.mock('@/views/symbol/SymbolTabs', () => ({
    SymbolTabs: () => <nav data-testid="symbol-tabs">tabs</nav>,
}));

vi.mock('@/views/symbol/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => <div data-testid="tabs-skeleton">loading</div>,
}));

// The header only wires props through to AnalysisSettingsMenu now — the real
// ModelSelector/ReasoningToggle behavior (gear popover open/close, focus,
// active dot, gating) is covered by AnalysisSettingsMenu's own test file.
// This fake mirrors just enough of the real widget's shape (gear trigger +
// popover disclosure) so header tests that need to reach the model
// selector/reasoning toggle can do so by opening the gear first, matching
// the real interaction shape instead of bypassing it.
vi.mock('@/widgets/analysis/AnalysisSettingsMenu', () => ({
    AnalysisSettingsMenu: ({
        modelId,
        reasoning,
        canUseReasoning,
        setReasoning,
        openSignupNudge,
    }: {
        modelId: string;
        reasoning: boolean;
        canUseReasoning: boolean;
        setReasoning: (v: boolean) => void;
        openSignupNudge: () => void;
        [key: string]: unknown;
    }) => {
        const [open, setOpen] = useState(false);
        return (
            <div>
                <button
                    type="button"
                    data-testid="settings-gear"
                    onClick={() => setOpen(o => !o)}
                >
                    분석 설정
                </button>
                {open && (
                    <div data-testid="settings-popover">
                        <div data-testid="model-selector">{modelId}</div>
                        <button
                            type="button"
                            data-testid="reasoning-toggle"
                            onClick={() =>
                                canUseReasoning
                                    ? setReasoning(!reasoning)
                                    : openSignupNudge()
                            }
                        >
                            {canUseReasoning
                                ? reasoning
                                    ? 'on'
                                    : 'off'
                                : 'locked'}
                        </button>
                    </div>
                )}
            </div>
        );
    },
}));

// Throw-capable so the ErrorBoundary fallback={null} path can be exercised.
const { mockFearGreedChip } = vi.hoisted(() => ({
    mockFearGreedChip: vi.fn(),
}));

vi.mock('@/views/symbol/FearGreedHeaderChip', () => ({
    FearGreedHeaderChip: () => mockFearGreedChip(),
}));

vi.mock('@/features/premium-gate/ui/PremiumModelGateModal', () => ({
    PremiumModelGateModal: () => <div data-testid="gate-modal">modal</div>,
}));

vi.mock('@/shared/lib/llmProviderLabels', () => ({
    LLM_PROVIDER_LABELS: { google: 'Google' },
}));

vi.mock('@/widgets/share/ui/ShareButton', () => ({
    ShareButton: () => <button data-testid="share-button">공유</button>,
}));

vi.mock('@/features/portfolio-holding/ui/PortfolioChipMounted', () => ({
    PortfolioChipMounted: () => (
        <span data-testid="portfolio-chip">portfolio</span>
    ),
}));

describe('SymbolLayoutHeader', () => {
    beforeEach(() => {
        mockOpenSignupNudge.mockReset();
        mockSegment.current = null;
        mockUseSymbolModel.mockReturnValue(symbolModelValue());
        mockFearGreedChip.mockImplementation(() => (
            <span data-testid="fear-greed-chip">FG</span>
        ));
    });

    /**
     * 이 크롬은 `<main>` 밖이라 `<header>`면 banner 랜드마크가 되고, 사이트 헤더와 함께
     * banner가 둘이 된다. 브레드크럼은 이름 붙은 `<nav>` 랜드마크다.
     */
    it('banner 랜드마크를 만들지 않고, 브레드크럼은 이름 붙은 nav>ol이다', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.queryByRole('banner')).toBeNull();
        const nav = screen.getByRole('navigation', { name: '이동 경로' });
        expect(nav.querySelector('ol')).not.toBeNull();
    });

    it('renders the SIGLENS logo link (JSON-LD와 같은 SITE_NAME 텍스트, 대문자는 CSS)', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        const link = screen.getByText('Siglens');
        expect(link.closest('a')?.getAttribute('href')).toBe('/');
        expect(link.className).toContain('uppercase');
    });

    it('차트 탭에서는 종목명 마디가 현재 페이지이고 셋째 마디가 없다', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        const current = screen
            .getByRole('navigation', { name: '이동 경로' })
            .querySelector('[aria-current="page"]');
        expect(current).toHaveTextContent('(AAPL)');
        expect(screen.queryByText('뉴스')).toBeNull();
    });

    it('하위 탭에서는 탭 라벨이 셋째 마디(현재 페이지)로 sm 이상에서 보인다', () => {
        mockSegment.current = 'news';
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        const crumb = screen.getByText('뉴스');
        expect(crumb.tagName).toBe('LI');
        expect(crumb).toHaveAttribute('aria-current', 'page');
        expect(crumb.className).toContain('sm:inline');
    });

    it('renders the uppercased ticker', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByText('(AAPL)')).toBeDefined();
    });

    it('renders the company name', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByText('Apple Inc.')).toBeDefined();
    });

    it('renders the korean name', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByText(/애플/)).toBeDefined();
    });

    it('차트 탭(/{T})에서는 종목명이 링크가 아니다 (자기 자신)', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByText('(AAPL)').closest('a')).toBeNull();
    });

    it.each(['news', 'fundamental', 'fear-greed', 'overall'])(
        '하위 탭(%s)에서는 종목명이 차트 /{T}로 가는 링크다',
        segment => {
            mockSegment.current = segment;
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );
            const link = screen.getByText('(AAPL)').closest('a');
            expect(link).toHaveAttribute('href', '/AAPL');
            expect(link).toHaveTextContent('Apple Inc.');
        }
    );

    it('renders the 분석 설정 gear (model selector + reasoning toggle are consolidated behind it)', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByTestId('settings-gear')).toBeDefined();
        // Collapsed by default — the model selector isn't in the DOM until
        // the gear is opened, mirroring the real AnalysisSettingsMenu.
        expect(screen.queryByTestId('model-selector')).toBeNull();
    });

    it('opening the gear reveals the model selector', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        fireEvent.click(screen.getByTestId('settings-gear'));
        expect(screen.getByTestId('model-selector')).toBeDefined();
    });

    it('renders the portfolio holding chip', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        expect(screen.getByTestId('portfolio-chip')).toBeDefined();
    });

    it('still renders the reasoning toggle for free/anonymous tier (canUseReasoning=false), locked rather than hidden', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ canUseReasoning: false })
        );

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        fireEvent.click(screen.getByTestId('settings-gear'));
        const toggle = screen.getByTestId('reasoning-toggle');
        expect(toggle).toBeDefined();
        expect(toggle.textContent).toBe('locked');
    });

    it('shows the reasoning toggle for member/pro tier (canUseReasoning=true)', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ reasoning: true, canUseReasoning: true })
        );

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        fireEvent.click(screen.getByTestId('settings-gear'));
        const toggle = screen.getByTestId('reasoning-toggle');
        expect(toggle).toBeDefined();
        expect(toggle.textContent).toBe('on');
    });

    it('member: clicking the toggle calls setReasoning (no signup nudge)', () => {
        const setReasoning = vi.fn();
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ setReasoning, canUseReasoning: true })
        );

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        fireEvent.click(screen.getByTestId('settings-gear'));
        fireEvent.click(screen.getByTestId('reasoning-toggle'));

        expect(setReasoning).toHaveBeenCalledWith(true);
        // Members never trigger the shared signup-nudge opener.
        expect(mockOpenSignupNudge).not.toHaveBeenCalled();
    });

    it('non-member: clicking the locked toggle opens the shared signup nudge (via provider opener)', () => {
        mockUseSymbolModel.mockReturnValueOnce(
            symbolModelValue({ canUseReasoning: false })
        );

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );
        fireEvent.click(screen.getByTestId('settings-gear'));
        // The header does NOT render the modal itself — the provider owns the
        // single instance. Clicking the locked toggle only calls the opener.
        expect(mockOpenSignupNudge).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('reasoning-toggle'));

        expect(mockOpenSignupNudge).toHaveBeenCalledTimes(1);
        // The modal is not rendered in the header's subtree.
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('swallows a thrown fear-greed chip error via ErrorBoundary and still renders the header', () => {
        // 칩은 이제 서버 스냅샷을 렌더하는 순수 컴포넌트지만, ErrorBoundary는
        // 그대로 둔다 — 칩이 어떤 이유로든 throw해도 헤더 셸은 살아남아야 한다
        // (#513이 지키던 SSR 실패 모드와 같은 계약).
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockFearGreedChip.mockImplementation(() => {
            throw new Error('bars fetch failed');
        });

        // try/finally so a failed assertion still restores the spy and doesn't
        // leak the console.error mock into sibling tests.
        try {
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            expect(screen.queryByTestId('fear-greed-chip')).toBeNull();
            expect(
                screen.getByRole('navigation', { name: '이동 경로' })
            ).toBeDefined();
            expect(screen.getByText('(AAPL)')).toBeDefined();
            // ErrorBoundary가 에러를 잡으면 React가 console.error로 보고한다 —
            // 에러 경로가 실제로 실행됐음을 검증.
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            consoleSpy.mockRestore();
        }
    });

    // 헤더 디클러터(분석 설정 기어 도입) 이후의 단일 행 회귀 커버리지. 이전엔
    // 모바일에서 두 줄(공포·탐욕+공유 / 모델·토글·보유종목 칩)로 쌓았지만, 모델
    // 셀렉터+추론 토글이 기어 팝오버 뒤로 합쳐지면서 남는 컨트롤은 [평단 칩]
    // [공유][기어] 3개의 아이콘 버튼뿐이라 모바일도 데스크톱도 한 행으로
    // 충분해졌다 — 헤더가 더 짧아졌는지(웹킷 회귀 가드) 검증하는 구조적
    // 증거이기도 하다. CSS(sm:hidden 등)는 jsdom에서 적용되지 않으므로 DOM
    // 그룹핑으로 검증한다: 공유 버튼·보유종목 칩·설정 기어가 같은 클러스터의
    // 형제이고, 그 클러스터는 모바일 공포·탐욕 칩과 같은 단일 컨트롤 행의
    // 형제다(더 이상 별도의 '외톨이 칩 행'이 없다).
    it('모바일 컨트롤 단일 행: 공포·탐욕 칩과 [평단 칩][공유][분석 설정 기어] 클러스터가 하나의 컨트롤 행에 모인다', () => {
        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        // 공유 버튼·보유종목 칩·설정 기어는 같은 버튼 클러스터의 형제다.
        const buttonCluster = screen.getByTestId('share-button').parentElement;
        expect(buttonCluster).not.toBeNull();
        expect(
            within(buttonCluster as HTMLElement).getByTestId('portfolio-chip')
        ).toBeInTheDocument();
        expect(
            within(buttonCluster as HTMLElement).getByTestId('settings-gear')
        ).toBeInTheDocument();

        // 그 클러스터는 모바일 공포·탐욕 칩과 같은 단일 컨트롤 행의 형제다 —
        // 더 이상 칩만 홀로 떨어진 별도 행이 없다.
        const controlRow = (buttonCluster as HTMLElement).parentElement;
        expect(controlRow).not.toBeNull();
        expect(
            within(controlRow as HTMLElement).getByTestId('fear-greed-chip')
        ).toBeInTheDocument();
    });

    it('renders the premium gate modal when the context exposes one', () => {
        mockUseSymbolModel.mockReturnValue(
            symbolModelValue({
                gateModal: { mode: 'upgrade', provider: 'google' },
            })
        );

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        expect(screen.getByTestId('gate-modal')).toBeInTheDocument();
    });

    describe('모바일 헤더 축약(375px에서 종목명이 잘리던 문제)', () => {
        it('SIGLENS 링크와 구분 슬래시는 모바일에서 감추고 sm 이상에서만 보인다', () => {
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            // 반응형 감춤은 마디(`<li>`)가 맡는다 — 안의 링크에 같은 클래스를 겹쳐 두지 않는다.
            const crumb = screen.getByText('Siglens').closest('li');
            expect(crumb?.className).toContain('hidden');
            expect(crumb?.className).toContain('sm:inline');
            expect(screen.getByText('Siglens').className).not.toContain(
                'hidden'
            );
            const slash = screen.getByText('/');
            expect(slash.className).toContain('hidden');
            expect(slash.className).toContain('sm:inline');
        });

        it('한국어명이 있으면 영문명(과 쉼표)만 모바일에서 감춘다', () => {
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            const english = screen.getByText('Apple Inc.');
            const hiddenWrapper = english.parentElement as HTMLElement;
            expect(hiddenWrapper.className).toContain('hidden');
            expect(hiddenWrapper.className).toContain('sm:inline');
            // 쉼표는 감춰지는 래퍼 안에 있어 모바일에서는 "애플 (AAPL)"이 된다.
            expect(hiddenWrapper.textContent).toBe(', Apple Inc.');
            // 한국어명과 티커는 감추지 않는다.
            const korean = screen.getByText('애플');
            expect(korean.className).not.toContain('hidden');
            expect(screen.getByText('(AAPL)').className).not.toContain(
                'hidden'
            );
        });

        it('한국어명이 없으면 영문명이 곧 종목명이라 모바일에서도 보인다', () => {
            vi.mocked(useAssetInfo).mockReturnValueOnce({
                name: 'Apple Inc.',
                koreanName: undefined,
                fmpSymbol: 'AAPL',
            } as ReturnType<typeof useAssetInfo>);

            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            const english = screen.getByText('Apple Inc.');
            expect(english.className).not.toContain('hidden');
            expect(english.parentElement?.className).not.toContain('hidden');
        });

        it('이름 span은 모바일 2줄 clamp, sm 이상은 한 줄 말줄임으로 크기도 갈린다', () => {
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            const nameSpan = screen.getByText('(AAPL)');
            expect(nameSpan.className).toContain('line-clamp-2');
            expect(nameSpan.className).toContain('text-base');
            expect(nameSpan.className).toContain('leading-tight');
            expect(nameSpan.className).toContain('sm:text-lg');
            expect(nameSpan.className).toContain('sm:truncate');
            expect(nameSpan.className).toContain('sm:line-clamp-none');
        });

        it('전체 이름 텍스트는 한 줄 그대로다(데스크톱 표기 불변)', () => {
            render(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />
            );

            const nameSpan = screen.getByText('(AAPL)');
            expect(nameSpan.textContent?.replace(/\s+/g, ' ').trim()).toBe(
                '애플, Apple Inc. (AAPL)'
            );
        });
    });

    it('omits the company-name segment when the name is just the ticker', () => {
        // Unseeded symbols come back with name === ticker. Rendering
        // "AAPL, AAPL (AAPL)" would be nonsense, so the breadcrumb drops the
        // company segment and separates the Korean name with a space instead
        // of a comma.
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: 'AAPL',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        } as ReturnType<typeof useAssetInfo>);

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        expect(screen.getByText('(AAPL)')).toBeInTheDocument();
        expect(screen.getByText(/애플/)).toBeInTheDocument();
        // The Korean name must not be followed by a comma when no company
        // name segment follows it.
        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });

    /**
     * 프로덕션 빌드 실증에서 잡힌 결함이다. `buildDisplayName`은 국내 종목에서 영문
     * 법인명을 빼도록 고쳤는데 이 헤더는 이름을 직접 조립해서, 같은 페이지의
     * `<title>`·description은 `삼성전자 (005930.KS)`인데 화면 상단만
     * `삼성전자, Samsung Electronics Co., Ltd. (005930.KS)`로 나갔다.
     */
    it('국내 상장 종목은 영문 법인명을 붙이지 않는다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: 'Samsung Electronics Co., Ltd.',
            koreanName: '삼성전자',
        } as ReturnType<typeof useAssetInfo>);

        render(
            <SymbolLayoutHeader
                symbol="005930.KS"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        expect(screen.getByText('(005930.KS)')).toBeInTheDocument();
        expect(screen.getByText(/삼성전자/)).toBeInTheDocument();
        expect(
            screen.queryByText(/Samsung Electronics/)
        ).not.toBeInTheDocument();
        // 영문명이 빠지면 쉼표도 빠져야 한다.
        expect(screen.queryByText(/삼성전자,/)).not.toBeInTheDocument();
    });

    it('종목 마스터 시드처럼 name과 koreanName이 같으면 한 번만 쓴다', () => {
        // 시드는 영문명을 주지 않아 `name`에 한글명을 넣는다 — 방문 전 종목이 이 상태다.
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '애플',
            koreanName: '애플',
        } as ReturnType<typeof useAssetInfo>);

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });

    /**
     * `shouldShowEnglishName`이 막는 회귀다. name이 빈 문자열인 종목(시세만 있고
     * 이름이 없는 크립토 등)에서 옛 `hasCompanyName`은 `name !== ''` 가드가 없어
     * true가 됐고, 그 결과 헤더가 `애플, (AAPL)`처럼 빈 span과 낙오된 쉼표를 렌더했다.
     */
    it('name이 빈 문자열이면 회사명 세그먼트도 쉼표도 렌더하지 않는다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '',
            koreanName: '애플',
        } as ReturnType<typeof useAssetInfo>);

        render(
            <SymbolLayoutHeader
                symbol="aapl"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />
        );

        expect(screen.getByText('(AAPL)')).toBeInTheDocument();
        expect(screen.getByText(/애플/)).toBeInTheDocument();
        expect(screen.queryByText(/애플,/)).not.toBeInTheDocument();
    });
});

/**
 * 브레드크럼 이름은 같은 페이지의 `<title>`(= `buildDisplayName`)과 **같은 것을
 * 말해야 한다.** 이 스위트의 다른 이름 테스트는 전부 전역 ko 프로바이더로
 * 렌더되므로 이 계열을 구조적으로 볼 수 없다.
 */
describe('SymbolLayoutHeader — 로케일별 이름', () => {
    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 영문명이 있으면 한국어명을 쓰지 않는다',
        locale => {
            vi.mocked(useAssetInfo).mockReturnValueOnce({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as ReturnType<typeof useAssetInfo>);

            renderWithIntl(
                <SymbolLayoutHeader
                    symbol="aapl"
                    fearGreedSnapshot={null}
                    {...CRUMB_PROPS}
                />,
                { locale }
            );

            expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
            expect(screen.queryByText(/애플/)).not.toBeInTheDocument();
        }
    );

    /**
     * 국내 종목 다수가 영문명이 비어 있다. 그때까지 티커만 남기면
     * `buildDisplayName`(`삼성전자 (005930.KS)`)과 헤더가 어긋난다.
     */
    it('en: 영문명이 없으면 한국어명으로 떨어진다', () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            name: '',
            koreanName: '삼성전자',
            fmpSymbol: '005930.KS',
        } as ReturnType<typeof useAssetInfo>);

        renderWithIntl(
            <SymbolLayoutHeader
                symbol="005930.KS"
                fearGreedSnapshot={null}
                {...CRUMB_PROPS}
            />,
            {
                locale: 'en',
            }
        );

        expect(screen.getByText(/삼성전자/)).toBeInTheDocument();
    });
});
