'use client';

import type { RefObject } from 'react';
import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneIndices } from '../types';

/**
 * 가격 pane이 보조 pane에 밀려 굶는 것을 막되, 보조 pane도 굶기지 않는다.
 *
 * **근거(라이브러리 소스 확인).** lightweight-charts 5.2.0은 pane 높이를 오직
 * stretch factor 비율로만 나눈다 — `ChartWidget._adjustSizeImpl`이
 * `stretchFactor * (전체높이 / stretch합)`을 쓰고 하한은 2px뿐이다.
 * `MIN_PANE_HEIGHT`(30)은 사용자가 구분선을 드래그하는 경로에만 걸린다.
 * 생성 시 가격 pane은 stretch 2(`DEFAULT_STRETCH_FACTOR * 2`), 추가 pane은 1이다.
 *
 * 246px 차트(모바일)에서 보조 pane 3개일 때 가격 pane은 40%(실측 86px)였다.
 * 그 높이에서는 이동평균 7개가 몇 픽셀 안에 겹쳐 사실상 구분되지 않고,
 * 범례는 pane보다 커진다.
 *
 * **왜 보조 pane의 stretch를 실제로 읽는가.** 보조 pane이 전부 1이라고 가정하면
 * 안 된다. 구분선 드래그 핸들러(`PaneSeparator._pressedMouseMoveEvent`)는 끌린
 * 두 pane 모두에 **절대값** stretch를 써 넣고, `enableResize`는 기본 true다.
 * pane 0을 0.5로, pane 1을 2.5로 끌어 둔 뒤 지표를 둘 더 켜면 보조 합계가
 * 4.5가 되어, 개수 기반(`max(2, N)` = 3)으로는 몫이 40%로 떨어진다(브라우저
 * 실측 44%). 그래서 합계를 직접 더해 `S ≥ 보조합계`로 잡는다 — 그래야 몫이
 * `S / (S + 보조합계) ≥ 1/2`가 보조 pane이 무엇을 들고 있든 참이 된다.
 *
 * **왜 상한이 필요한가.** 위 규칙만 두면 보조 pane 몫이 `1/(2+N)`에서 `1/(2N)`로
 * 줄어든다. 차트 상자는 `ChartContent`에서 고정 `flex-3`이라 pane이 늘어도
 * 커지지 않고, LWC의 높이 하한은 2px뿐이다 — 246px 모바일에서 보조 pane 6개면
 * 개당 26px에서 18px로 내려앉는다. 그래서 보조 pane 전체가 지켜야 할 픽셀
 * 예산(`N × MIN_SUB_PANE_PX`)을 실제 pane 높이 합에서 역산해 상한으로 건다.
 *
 * **실제 보장.** 가격 pane은 보조 pane이 최소 픽셀 예산을 지킬 수 있는 한
 * 절반 이상을 받는다. 그럴 여유가 없으면 보조 pane 쪽을 우선해 몫을 내주고,
 * 그래도 안 되면 LWC 기본값(2) — 즉 이 훅이 없던 시절의 배치 — 로 돌아간다.
 * 뒤집어 말하면 보조 pane 높이 합은 `N × MIN_SUB_PANE_PX`와 기본 배치에서의
 * 높이 합 중 **작은 쪽** 아래로 내려가지 않는다.
 *
 * pane 높이 합을 못 재면(전부 0) 상한이 음수가 되어 기본값으로 떨어진다.
 * 방향이 그쪽인 게 맞다 — 여유가 있다는 걸 확인하지 못한 채 가격 pane이
 * 보조 pane을 밀어내는 것보다, 오래 쓰던 기본 배치가 안전하다.
 *
 * 컨테이너가 커져(회전 등) 여유가 다시 생기는 경우는 다루지 않는다. 이 훅은
 * pane 개수가 바뀔 때만 돌아 다음 토글에서 따라잡는다.
 */
export const MIN_PRICE_PANE_STRETCH = 2;

/**
 * 보조 pane 하나가 지켜야 할 최소 높이(px).
 *
 * LWC 자신이 구분선 드래그에서 쓰는 `MIN_PANE_HEIGHT`와 같은 값이다. 이 아래로
 * 가면 `usePaneLabels`의 라벨 상자(`상단 8px 인셋 + 11px 한 줄 + 8px`)가 pane을
 * 넘어 아래를 침범하기 시작한다.
 */
export const MIN_SUB_PANE_PX = 30;

export function usePricePaneStretch(
    chartRef: RefObject<IChartApi | null>,
    paneIndices: PaneIndices
): void {
    useEffect(() => {
        /*
         * pane 추가·제거 직후에는 LWC가 아직 높이를 재분배하지 않아
         * `getHeight()`가 stale하다(`usePricePaneSize`가 같은 이유로 RAF를 쓴다).
         * 픽셀 상한을 재려면 확정된 높이가 필요하므로 다음 프레임으로 미룬다.
         */
        const rafId = requestAnimationFrame(() => {
            const chart = chartRef.current;
            if (!chart) return;

            const panes = chart.panes();
            const pricePane = panes[0];
            if (!pricePane) return;

            const subPanes = panes.slice(1);
            if (subPanes.length === 0) {
                pricePane.setStretchFactor(MIN_PRICE_PANE_STRETCH);
                return;
            }

            const subStretchTotal = subPanes.reduce(
                (total, pane) => total + pane.getStretchFactor(),
                0
            );
            const totalHeightPx = panes.reduce(
                (total, pane) => total + pane.getHeight(),
                0
            );
            const reservePx = subPanes.length * MIN_SUB_PANE_PX;

            // 보조 pane 높이 합 = H × 보조합계 / (S + 보조합계) ≥ reserve
            //   ⟺ S ≤ 보조합계 × (H − reserve) / reserve
            const pixelCap =
                (subStretchTotal * (totalHeightPx - reservePx)) / reservePx;

            pricePane.setStretchFactor(
                Math.max(
                    MIN_PRICE_PANE_STRETCH,
                    Math.min(subStretchTotal, pixelCap)
                )
            );
        });

        return () => cancelAnimationFrame(rafId);
    }, [chartRef, paneIndices]);
}
