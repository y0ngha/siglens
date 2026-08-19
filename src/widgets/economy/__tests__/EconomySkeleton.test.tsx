import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { EconomySkeleton } from '@/widgets/economy/sections/EconomySkeleton';
import { EconomicIndicatorGrid } from '@/widgets/economy/sections/EconomicIndicatorGrid';
import { KrEconomicIndicatorGrid } from '@/widgets/economy/sections/KrEconomicIndicatorGrid';
import {
    ECONOMY_INDICATOR_CATEGORIES,
    ECONOMY_INDICATORS,
} from '@/shared/config/economyIndicators';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';

describe('EconomySkeleton', () => {
    it('renders with role=status and aria-busy=true', () => {
        render(<EconomySkeleton />);
        const root = screen.getByRole('status');
        expect(root).toBeInTheDocument();
        expect(root).toHaveAttribute('aria-busy', 'true');
        expect(root).toHaveAttribute('aria-label', '경제 지표 로딩 중');
    });

    it('renders animate-pulse decorative regions (aria-hidden)', () => {
        const { container } = render(<EconomySkeleton />);
        // macro-facts section + briefing section + indicator grid section + calendar section
        const hiddenRegions = container.querySelectorAll(
            '[aria-hidden="true"]'
        );
        expect(hiddenRegions.length).toBe(4);
        // 그리드 밖 자리표 3개(거시 요약 / 브리핑 / 캘린더)를 고정한다 —
        // `> 0`은 어떤 회귀도 잡지 못한다.
        expect(
            container.querySelectorAll(
                '[role="status"] > section.animate-pulse'
            ).length
        ).toBe(3);
    });

    /**
     * 이 스켈레톤의 존재 이유는 "로딩 표시"가 아니라 **레이아웃 예약**이다. 카드 수가
     * 실제 그리드와 어긋나면 콘텐츠 도착 시 아래가 통째로 밀린다(실측: 모바일 CLS
     * 0.170). 그래서 개수를 눈으로 세지 않고 `EconomicIndicatorGrid`가 카드를 만드는
     * 것과 같은 규칙 — 레지스트리 + `rates`의 국채 3장 — 으로 계산해 맞춘다.
     */
    it('indicator 카드 수가 실제 그리드와 일치한다', () => {
        // 레지스트리 전 지표에 값이 있고 국채도 있는 "정상" 스냅샷 —
        // 자리표는 이 상태를 기준으로 자리를 잡는다.
        const snapshot: EconomySnapshot = {
            indicators: ECONOMY_INDICATORS.map(m => ({
                name: m.name,
                latest: { date: '2026-05-01', value: 1 },
                previous: { date: '2026-04-01', value: 0.9 },
                trend: [],
            })),
            treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
            calendar: [],
        };

        const grid = render(<EconomicIndicatorGrid snapshot={snapshot} />);
        const realCards =
            grid.container.querySelectorAll('.grid > article').length;
        cleanup();

        const skeleton = render(<EconomySkeleton />);
        const placeholderCards = skeleton.container.querySelectorAll(
            '.grid > .animate-pulse.rounded-xl'
        ).length;

        // 레지스트리 산술을 두 번 적는 대신 **실제 그리드가 그린 수**와 맞춘다 —
        // 국채 카드가 4장이 되는 식의 변경도 이 단언이 잡는다.
        expect(placeholderCards).toBe(realCards);
    });

    it('카테고리마다 제목 자리와 카드 그리드를 예약한다', () => {
        const { container } = render(<EconomySkeleton />);
        expect(container.querySelectorAll('.grid').length).toBe(
            ECONOMY_INDICATOR_CATEGORIES.length
        );
    });

    /**
     * `/economy/kr`도 같은 자리표를 쓴다. 한국 그리드는 국채 카드가 없고 카테고리별
     * 분포도 달라서(고용 1장), 미국 기본값을 그대로 쓰면 자리를 과하게 잡는다.
     */
    it('variant="kr"이면 한국 카드 수만큼만 예약하고 거시 카드를 그리지 않는다', () => {
        const { container } = render(<EconomySkeleton variant="kr" />);
        expect(
            container.querySelectorAll('.grid > .animate-pulse.rounded-xl')
                .length
        ).toBe(KR_ECONOMY_INDICATORS.length);
        // 한국 화면에는 거시 요약·브리핑 카드가 없다 — 캘린더 자리표 하나만 남는다.
        expect(
            container.querySelectorAll(
                '[role="status"] > section.animate-pulse'
            ).length
        ).toBe(1);
    });
});

/** `space-y-*` 토큰만 뽑는다 — 나머지 클래스는 이 단언의 관심사가 아니다. */
function sectionGap(el: Element | null): string | undefined {
    return [...(el?.classList ?? [])].find(c => c.startsWith('space-y-'));
}

/**
 * 자리표의 **간격**도 실제 그리드와 맞는지 본다. 카드 수만 맞추고 간격이 어긋나면
 * 이 파일이 막으려는 레이아웃 이동이 그대로 재현된다 — 그런데 간격은 손으로 옮겨
 * 적은 리터럴이라 반대쪽에 아무 단언이 없었다(감사: 라운드 4 P3).
 */
describe('EconomySkeleton 간격', () => {
    const SNAPSHOT: EconomySnapshot = {
        indicators: ECONOMY_INDICATORS.map(m => ({
            name: m.name,
            latest: { date: '2026-05-01', value: 1 },
            previous: { date: '2026-04-01', value: 0.9 },
            trend: [],
        })),
        treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
        calendar: [],
    };
    const KR_CARDS = KR_ECONOMY_INDICATORS.map(meta => ({
        meta,
        latest: 1,
        latestDate: '2026-05-01',
        changeFromPrevious: null,
    }));

    it.each([
        ['us' as const, () => <EconomicIndicatorGrid snapshot={SNAPSHOT} />],
        ['kr' as const, () => <KrEconomicIndicatorGrid cards={KR_CARDS} />],
    ])('variant=%s의 섹션 간격이 실제 그리드와 같다', (variant, renderGrid) => {
        const real = render(renderGrid());
        const realGap = sectionGap(real.container.querySelector('section'));
        expect(realGap).toBeDefined();
        cleanup();

        const skeleton = render(<EconomySkeleton variant={variant} />);
        // 자리표에서 카드 그리드를 감싸는 section = 유일하게 animate-pulse가 아닌 것.
        expect(
            sectionGap(
                skeleton.container.querySelector(
                    '[role="status"] > section:not(.animate-pulse)'
                )
            )
        ).toBe(realGap);
    });
});
