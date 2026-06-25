vi.mock('@/widgets/chat/FloatingChatButton', () => ({
    FloatingChatButton: ({ symbol }: { symbol: string }) => (
        <button data-testid="chat-button">{symbol}</button>
    ),
}));
vi.mock('@/features/symbol-chat', () => ({
    SymbolChatProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="chat-provider">{children}</div>
    ),
}));
vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    SymbolModelProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="model-provider">{children}</div>
    ),
}));
vi.mock('next/navigation', () => ({
    useSelectedLayoutSegment: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { useSelectedLayoutSegment } from 'next/navigation';
import {
    SymbolLayoutProviders,
    SymbolLayoutFloatingChat,
    SymbolLayoutJail,
} from '@/app/[symbol]/SymbolLayoutClient';

const mockSegment = vi.mocked(useSelectedLayoutSegment);

describe('SymbolLayoutProviders', () => {
    it('renders children inside SymbolChatProvider and SymbolModelProvider', () => {
        render(
            <SymbolLayoutProviders>
                <div data-testid="child">content</div>
            </SymbolLayoutProviders>
        );

        expect(screen.getByTestId('chat-provider')).toBeInTheDocument();
        expect(screen.getByTestId('model-provider')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});

describe('SymbolLayoutFloatingChat', () => {
    it('renders FloatingChatButton with the given symbol', () => {
        render(<SymbolLayoutFloatingChat symbol="AAPL" />);

        expect(screen.getByTestId('chat-button')).toHaveTextContent('AAPL');
    });
});

// "AI 분석이 길어지면 차트도 길어진다" 회귀 가드 — 차트 높이 고정 부분.
//
// jsdom에는 레이아웃 엔진이 없어 차트가 실제로 고정 픽셀 높이를 유지하는지 측정할 수
// 없다. 대신 그 동작을 만들어내는 CSS 계약을 검증한다: 차트(index) 라우트에서 jail은
// definite height로 고정되고 overflow-hidden으로 클립되므로, 긴 AI 분석은 차트 행을
// 늘리지 못하고 패널 자체의 overflow-y-auto 영역 안에서 스크롤된다. 이 계약은 분석이
// 길든 짧든 동일해야 한다 — 그 불변성이 바로 회귀 가드다(버그의 본질은 "분석 길이가
// 레이아웃 높이를 바꾼다"였다). 형제 탭은 반대로 min-h를 유지해 콘텐츠 길이에 따라
// 자라고 페이지가 스크롤된다.
describe('SymbolLayoutJail (차트 높이 고정)', () => {
    const DEFINITE_HEIGHT =
        'h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))]';
    const MIN_HEIGHT =
        'min-h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))]';
    const SIBLING_SEGMENTS = [
        'news',
        'fundamental',
        'options',
        'overall',
        'fear-greed',
    ];

    // 긴 AI 분석 패널과 짧은 패널의 대역. 콘텐츠 길이는 의도적으로 단언 결과에 영향을
    // 주지 않는다 — 그 무관함(불변성)이 바로 이 테스트가 지키려는 핵심이다.
    // 긴 패널을 시뮬레이션하기에 충분한 문단 수.
    const LONG_PARAGRAPH_COUNT = 80;
    const LONG_ANALYSIS = (
        <div data-testid="analysis">
            {Array.from({ length: LONG_PARAGRAPH_COUNT }, (_, i) => (
                <p key={i}>분석 문단 {i}</p>
            ))}
        </div>
    );
    const SHORT_ANALYSIS = <div data-testid="analysis">짧은 분석</div>;

    const renderJail = (child: React.ReactNode) => {
        const { container } = render(
            <SymbolLayoutJail>{child}</SymbolLayoutJail>
        );
        return container.firstElementChild as HTMLElement;
    };

    describe('차트(index) 라우트', () => {
        beforeEach(() => {
            mockSegment.mockReturnValue(null);
        });

        describe('AI 분석 패널이 길 때', () => {
            it('jail이 definite height + overflow-hidden을 유지해 패널이 내부 스크롤되고 차트는 늘어나지 않는다', () => {
                const jail = renderJail(LONG_ANALYSIS);

                expect(jail.className).toContain(DEFINITE_HEIGHT);
                expect(jail.className).toContain('overflow-hidden');
                // 버그는 min-h로 되돌아간다 — min-h면 긴 패널이 차트를 늘린다.
                expect(jail.className).not.toContain(MIN_HEIGHT);
            });
        });

        describe('AI 분석 패널이 짧을 때', () => {
            it('콘텐츠가 짧아도 동일한 definite height(min-height 아님)를 유지해 차트가 viewport를 채운다', () => {
                const jail = renderJail(SHORT_ANALYSIS);

                expect(jail.className).toContain(DEFINITE_HEIGHT);
                expect(jail.className).toContain('overflow-hidden');
                expect(jail.className).not.toContain(MIN_HEIGHT);
            });
        });
    });

    describe('형제 탭 라우트', () => {
        describe('콘텐츠가 길 때', () => {
            it.each(SIBLING_SEGMENTS)(
                '"%s" 라우트는 overflow-hidden 없이 growable min-height라 긴 콘텐츠가 페이지를 스크롤한다',
                segment => {
                    mockSegment.mockReturnValue(segment);

                    const jail = renderJail(LONG_ANALYSIS);

                    expect(jail.className).toContain(MIN_HEIGHT);
                    expect(jail.className).not.toContain('overflow-hidden');
                }
            );
        });

        describe('콘텐츠가 짧을 때', () => {
            it.each(SIBLING_SEGMENTS)(
                '"%s" 라우트는 min-height를 유지해 짧은 페이지도 viewport를 채우고 sticky footer가 하단에 남는다',
                segment => {
                    mockSegment.mockReturnValue(segment);

                    const jail = renderJail(SHORT_ANALYSIS);

                    expect(jail.className).toContain(MIN_HEIGHT);
                    expect(jail.className).not.toContain('overflow-hidden');
                }
            );
        });
    });
});
