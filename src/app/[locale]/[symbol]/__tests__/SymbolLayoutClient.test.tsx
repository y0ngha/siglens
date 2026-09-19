vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    SymbolModelProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="model-provider">{children}</div>
    ),
}));
import { render, screen } from '@testing-library/react';
import {
    SymbolLayoutProviders,
    SymbolLayoutJail,
} from '@/app/[locale]/[symbol]/SymbolLayoutClient';

describe('SymbolLayoutProviders', () => {
    it('renders children inside SymbolModelProvider', () => {
        render(
            <SymbolLayoutProviders>
                <div data-testid="child">content</div>
            </SymbolLayoutProviders>
        );

        expect(screen.getByTestId('model-provider')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});

// 단일 문서 스크롤 회귀 가드.
//
// jsdom에는 레이아웃 엔진이 없어 스크롤러가 몇 개인지 측정할 수 없다. 대신 그 동작을
// 만들어내는 CSS 계약을 검증한다: jail은 **어느 라우트에서도** growable `min-h` 박스이며
// 자체 클립·스크롤을 갖지 않는다. 예전에는 차트(index) 라우트만 예외로
// `md:h-[calc(...)] + md:overflow-hidden`이었고, 그래서 그 안의 `<main>`이 자기
// `overflow-y-auto`로 아래 콘텐츠를 노출해야 했다 — 데스크톱에 스크롤바가 셋이 됐다
// (main, AI 패널, body). 차트의 확정 높이는 이제 차트 컬럼 자신이 `--symbol-chart-h`로
// 들고 있으므로(ChartContent) jail이 높이를 확정할 이유가 없다.
//
// "AI 분석이 길어져도 차트는 늘어나지 않는다"는 원래의 불변성은 그대로다. 다만 그것을
// 지키는 지점이 jail이 아니라 차트 컬럼으로 옮겨졌고, 그쪽 계약은
// `views/symbol/__tests__/ChartContent.test.tsx`가 고정한다.
describe('SymbolLayoutJail (단일 문서 스크롤)', () => {
    const MIN_HEIGHT =
        'min-h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))]';

    // 긴 콘텐츠와 짧은 콘텐츠의 대역. 콘텐츠 길이는 의도적으로 단언 결과에 영향을
    // 주지 않는다 — 그 무관함(불변성)이 바로 이 테스트가 지키려는 핵심이다.
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

    describe.each([
        ['긴', LONG_ANALYSIS],
        ['짧은', SHORT_ANALYSIS],
    ])('콘텐츠가 %s 때', (_label, child) => {
        it('growable min-height를 유지해 짧은 페이지도 viewport를 채우고 긴 페이지는 문서가 스크롤한다', () => {
            const jail = renderJail(child);

            expect(jail.className).toContain(MIN_HEIGHT);
        });

        it('확정 높이를 걸지 않는다 — 걸면 그 안에서 또 스크롤해야 한다', () => {
            const jail = renderJail(child);

            // `min-h-[...]`는 포함되므로 `h-[`로 좁혀 확정 높이만 잡는다.
            expect(jail.className).not.toMatch(/(?:^|\s)(?:md:)?h-\[/);
        });

        it('자체 스크롤 컨테이너가 아니다 (클립도 내부 스크롤도 없다)', () => {
            const jail = renderJail(child);

            expect(jail.className).not.toContain('overflow-hidden');
            expect(jail.className).not.toContain('overflow-y-auto');
        });
    });
});
