'use client';

/**
 * AI 작도(`chartOverlays`) → 가격 차트에 그릴 선 스펙 계산 훅. 패턴 팔레트·레벨 제목 문구·
 * 꺼진/강조 항목·도달 판정을 묶어 화면용 스펙과 여백 계산용 제목 목록을 함께 낸다.
 */
import { useMemo } from 'react';
import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { CHART_OVERLAY_COLORS } from '../model/chartOverlayCategories';
import {
    barTimesOf,
    buildOverlayLineSpecs,
    hasDrawnLevels,
    overlayColorFor,
    type OverlayLineSpec,
} from '../utils/chartOverlayUtils';
import { levelTitleFor } from '../utils/levelTitle';
import {
    patternLabelsByKey,
    patternPaletteByKey,
    type OverlayMenuItem,
} from '../utils/overlayItems';
import { isReachedTarget } from '../utils/reachedLevel';
import { useLevelTitleTexts } from './useLevelTitleTexts';

interface UseChartOverlaySpecsParams {
    chartOverlays: ChartOverlay[];
    /** 패턴 오버레이의 스킬별 색 — `sourceRef → renderConfig.color`. */
    overlayColors: Record<string, string>;
    overlayItems: readonly OverlayMenuItem[];
    hiddenOverlayKeys: ReadonlySet<string>;
    highlightedOverlayKey: string | null;
    /** 정규장 봉 — 작도가 봉에 맞는지, 마지막 종가로 지나간 목표인지 판정한다. */
    bars: Bar[];
    /** RSI 패인 인덱스. 꺼져 있으면 null(RSI 다이버전스 작도를 그리지 않는다). */
    rsiPaneIndex: number | null;
    /** 수평 레벨 오른쪽 연장 — 사용자 설정. */
    extendLevelsRight: boolean;
}

interface UseChartOverlaySpecsReturn {
    /** 화면에 그릴 스펙(강조 반영). */
    specs: OverlayLineSpec[];
    /**
     * 레벨 제목 전체 목록(강조 제외) — 오른쪽 여백 계산용. 보이는 라벨로 재면 hover마다
     * 여백이 늘었다 줄며 `rightOffsetPixels`가 스크롤을 끝으로 되돌려 차트가 흔들린다.
     */
    levelTitles: string[];
    /** 연장할 수평 레벨이 하나라도 그려지는가 — "오른쪽 연장" 설정 노출 여부. */
    hasExtendableLevels: boolean;
    /** 패턴 항목별 팔레트 색 — 메뉴 항목 색 점과 같은 값. */
    patternPalette: ReadonlyMap<string, string>;
}

/** 작도·꺼짐/강조 상태·봉으로 화면 스펙, 여백용 제목 목록, 연장 가능 여부, 패턴 팔레트를 계산한다. */
export function useChartOverlaySpecs({
    chartOverlays,
    overlayColors,
    overlayItems,
    hiddenOverlayKeys,
    highlightedOverlayKey,
    bars,
    rsiPaneIndex,
    extendLevelsRight,
}: UseChartOverlaySpecsParams): UseChartOverlaySpecsReturn {
    const levelTexts = useLevelTitleTexts();
    const patternLabels = useMemo(
        () => patternLabelsByKey(overlayItems),
        [overlayItems]
    );
    // 패턴이 둘 이상이면 항목마다 팔레트 색 — 스킬 색(상승/하락/중립)만으로는 같은 방향
    // 패턴끼리 겹친다. 테마 토글은 차트를 remount하므로 마운트 시점 테마 값으로 충분하다.
    const patternPalette = useMemo(
        () =>
            patternPaletteByKey(overlayItems, [
                CHART_COLORS.overlayPattern1,
                CHART_COLORS.overlayPattern2,
                CHART_COLORS.overlayPattern3,
                CHART_COLORS.overlayPattern4,
                CHART_COLORS.overlayPattern5,
                CHART_COLORS.overlayPattern6,
            ]),
        [overlayItems]
    );

    const barTimes = useMemo(() => barTimesOf(bars), [bars]);
    const lastBarTime = bars.at(-1)?.time ?? 0;
    // 지나간 목표선 판정의 기준 — 마지막 봉의 종가(장중이면 진행 중인 봉).
    const lastClose = bars.at(-1)?.close ?? null;

    const hasExtendableLevels = useMemo(
        () =>
            hasDrawnLevels(chartOverlays, {
                hiddenKeys: hiddenOverlayKeys,
                barTimes,
                lastBarTime,
            }),
        [chartOverlays, hiddenOverlayKeys, barTimes, lastBarTime]
    );

    // 강조 항목만 인자로 뺀다 — 같은 입력에서 화면 스펙과 여백용 제목 목록을 둘 다 뽑는다.
    const buildSpecs = useMemo(
        () => (highlightedKey: string | null) =>
            buildOverlayLineSpecs(chartOverlays, {
                hiddenKeys: hiddenOverlayKeys,
                highlightedKey,
                barTimes,
                lastBarTime,
                rsiPaneIndex,
                colorFor: (overlay, role) =>
                    (overlay.kind === 'pattern'
                        ? patternPalette.get(overlay.sourceRef)
                        : undefined) ??
                    overlayColorFor(
                        overlay,
                        role,
                        overlayColors,
                        CHART_OVERLAY_COLORS
                    ),
                levelLabelFor: (label, overlay, reached) =>
                    levelTitleFor(
                        label,
                        overlay,
                        {
                            ...levelTexts,
                            cardName: patternLabels.get(overlay.sourceRef),
                        },
                        reached
                    ),
                isReachedLevel: (level, overlay) =>
                    isReachedTarget(level, overlay, lastClose),
                extendLevelsRight,
            }),
        [
            chartOverlays,
            hiddenOverlayKeys,
            barTimes,
            lastBarTime,
            rsiPaneIndex,
            overlayColors,
            patternPalette,
            levelTexts,
            patternLabels,
            lastClose,
            extendLevelsRight,
        ]
    );

    const specs = useMemo(
        () => buildSpecs(highlightedOverlayKey),
        [buildSpecs, highlightedOverlayKey]
    );
    const levelTitles = useMemo(
        () => buildSpecs(null).map(spec => spec.title),
        [buildSpecs]
    );

    return { specs, levelTitles, hasExtendableLevels, patternPalette };
}
