import type { OverlayKind } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

/** 처음 방문 시 켜 둘 카테고리 — 패턴·추세선만(선이 많아지면 가격이 안 보인다). */
export const DEFAULT_CHART_OVERLAY_VISIBILITY: Readonly<
    Record<OverlayKind, boolean>
> = {
    pattern: true,
    trendline: true,
    divergence: false,
    fibonacci: false,
    elliott: false,
};

/**
 * 드롭다운 표시 순서 — `DEFAULT_CHART_OVERLAY_VISIBILITY`에서 파생한다.
 * 별도 배열로 하드코딩했더니 core에 새 `OverlayKind`가 추가돼도 이 목록이 조용히
 * 누락될 수 있었다(런타임에만 드러나는 버그). `Record<OverlayKind, boolean>`
 * 타입이 위 상수의 모든 키를 컴파일 타임에 강제하므로, 여기서 그 키만 뽑으면
 * 새 kind 누락이 타입 에러로 드러난다.
 */
export const CHART_OVERLAY_KINDS: readonly OverlayKind[] = Object.keys(
    DEFAULT_CHART_OVERLAY_VISIBILITY
) as OverlayKind[];

/**
 * 패턴 외 kind의 고정 색 — 게터라 접근 시점의 테마를 따른다(`CHART_COLORS`와 동일 규약).
 * 패턴은 스킬 frontmatter 색(`renderConfig.color`)을 우선하고, 여기 `pattern`은 그게
 * 없을 때만 쓰는 폴백이다. support/resistance는 캔들 상승/하락 색과 동일 팔레트를 재사용해
 * 새 hex를 들여오지 않는다.
 */
/**
 * kind별 색 + 추세선 role별 색 — 새 `OverlayKind`가 생기면 여기서 컴파일 에러가 난다.
 * 추세선은 kind가 아니라 role(support/resistance)로 색을 고르므로 kind 키에서 뺀다.
 */
export type OverlayColorTable = Readonly<
    Record<
        Exclude<OverlayKind, 'trendline'> | 'support' | 'resistance',
        () => string
    >
>;

export const CHART_OVERLAY_COLORS: OverlayColorTable = {
    pattern: () => CHART_COLORS.neutral,
    support: () => CHART_COLORS.bullish,
    resistance: () => CHART_COLORS.bearish,
    divergence: () => CHART_COLORS.macdSignal,
    fibonacci: () => CHART_COLORS.bollingerUpper,
    elliott: () => CHART_COLORS.stochasticK,
};

export const ALTERNATE_OVERLAY_OPACITY = 0.5;
export const DIMMED_OVERLAY_OPACITY = 0.3;
export const HIGHLIGHT_LINE_WIDTH_MULT = 2;

/** core 패턴 오버레이의 돌파선 레벨 라벨(언어 중립 키) — 화면에서 번역 문구로 바꾼다. */
export const BREAKOUT_LEVEL_LABEL = 'breakout';
