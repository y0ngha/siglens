'use client';

/**
 * 가격 패인 위에 겹쳐 그리는 지표(이평·밴드·채널·추세 추종·일목·매물대)를 모두 연결하고,
 * 그 상태를 지표 메뉴 binding과 범례 라벨 설정으로 내보내는 훅.
 */
import { useMemo } from 'react';
import { EMA_DEFAULT_PERIODS, MA_DEFAULT_PERIODS } from '@y0ngha/siglens-core';
import type { IndicatorHookParams } from '../model/chartHookParams';
import type { IndicatorBinding } from '../model/indicatorRegistry';
import {
    buildOverlayLabelConfigs,
    type OverlayLabelConfig,
} from '../utils/overlayLabelUtils';
import { useBollingerOverlay } from './useBollingerOverlay';
import { useChandelierOverlay } from './useChandelierOverlay';
import { useDonchianOverlay } from './useDonchianOverlay';
import { useEMAOverlay } from './useEMAOverlay';
import { useIchimokuOverlay } from './useIchimokuOverlay';
import { useKeltnerOverlay } from './useKeltnerOverlay';
import { useMAOverlay } from './useMAOverlay';
import { useParabolicSarOverlay } from './useParabolicSarOverlay';
import { useSupertrendOverlay } from './useSupertrendOverlay';
import { useVolumeProfileOverlay } from './useVolumeProfileOverlay';

/** 지표 메뉴 binding 중 이 훅이 소유하는 부분(`meta`는 레지스트리가 붙인다). */
export type IndicatorBindingOverride = Omit<IndicatorBinding, 'meta'>;

interface UsePriceOverlayIndicatorsReturn {
    /**
     * 레지스트리 key → binding 오버라이드. 지표 메뉴는 여기 있는 key를 우선하고, 없으면
     * `useIndicatorVisibility`의 기본 on/off로 폴백한다(`buildIndicatorBindings`).
     */
    bindingOverrides: Partial<Record<string, IndicatorBindingOverride>>;
    /** 켜진 오버레이의 범례 라벨 설정. */
    labelConfigs: OverlayLabelConfig[];
}

/** 가격 패인 오버레이 지표 훅을 모두 부르고, 그 상태를 메뉴 binding·범례 라벨 설정으로 모은다. */
export function usePriceOverlayIndicators(
    params: IndicatorHookParams,
    /** 일목 선행 구름의 시작 시각 — 마지막으로 **그려진** 봉(시간외 포함). */
    futureAnchorTime: number | undefined
): UsePriceOverlayIndicatorsReturn {
    const ma = useMAOverlay(params);
    const ema = useEMAOverlay(params);
    const bollinger = useBollingerOverlay(params);
    const keltner = useKeltnerOverlay(params);
    const donchian = useDonchianOverlay(params);
    const supertrend = useSupertrendOverlay(params);
    const parabolicSar = useParabolicSarOverlay(params);
    const chandelier = useChandelierOverlay(params);
    const volumeProfile = useVolumeProfileOverlay(params);
    const ichimoku = useIchimokuOverlay({ ...params, futureAnchorTime });

    const bindingOverrides = useMemo(
        () => ({
            ma: {
                active: ma.visiblePeriods.length > 0,
                availablePeriods: MA_DEFAULT_PERIODS,
                visiblePeriods: ma.visiblePeriods,
                onTogglePeriod: ma.togglePeriod,
            },
            ema: {
                active: ema.visiblePeriods.length > 0,
                availablePeriods: EMA_DEFAULT_PERIODS,
                visiblePeriods: ema.visiblePeriods,
                onTogglePeriod: ema.togglePeriod,
            },
            ichimoku: { active: ichimoku.isVisible, onToggle: ichimoku.toggle },
            bollinger: {
                active: bollinger.isVisible,
                onToggle: bollinger.toggle,
            },
            volumeProfile: {
                active: volumeProfile.isVisible,
                onToggle: volumeProfile.toggle,
            },
            keltnerChannel: {
                active: keltner.isVisible,
                onToggle: keltner.toggle,
            },
            donchianChannel: {
                active: donchian.isVisible,
                onToggle: donchian.toggle,
            },
            supertrend: {
                active: supertrend.isVisible,
                onToggle: supertrend.toggle,
            },
            parabolicSar: {
                active: parabolicSar.isVisible,
                onToggle: parabolicSar.toggle,
            },
            chandelierExit: {
                active: chandelier.isVisible,
                onToggle: chandelier.toggle,
            },
        }),
        [
            ma.visiblePeriods,
            ma.togglePeriod,
            ema.visiblePeriods,
            ema.togglePeriod,
            ichimoku.isVisible,
            ichimoku.toggle,
            bollinger.isVisible,
            bollinger.toggle,
            volumeProfile.isVisible,
            volumeProfile.toggle,
            keltner.isVisible,
            keltner.toggle,
            donchian.isVisible,
            donchian.toggle,
            supertrend.isVisible,
            supertrend.toggle,
            parabolicSar.isVisible,
            parabolicSar.toggle,
            chandelier.isVisible,
            chandelier.toggle,
        ]
    );

    const labelConfigs = useMemo(
        () =>
            buildOverlayLabelConfigs({
                maVisiblePeriods: ma.visiblePeriods,
                emaVisiblePeriods: ema.visiblePeriods,
                bollingerVisible: bollinger.isVisible,
                ichimokuVisible: ichimoku.isVisible,
                vpVisible: volumeProfile.isVisible,
                keltnerVisible: keltner.isVisible,
                donchianVisible: donchian.isVisible,
                supertrendVisible: supertrend.isVisible,
                parabolicSarVisible: parabolicSar.isVisible,
                chandelierVisible: chandelier.isVisible,
            }),
        [
            ma.visiblePeriods,
            ema.visiblePeriods,
            bollinger.isVisible,
            ichimoku.isVisible,
            volumeProfile.isVisible,
            keltner.isVisible,
            donchian.isVisible,
            supertrend.isVisible,
            parabolicSar.isVisible,
            chandelier.isVisible,
        ]
    );

    return { bindingOverrides, labelConfigs };
}
