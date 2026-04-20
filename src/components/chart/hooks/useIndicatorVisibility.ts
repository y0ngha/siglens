'use client';

import { useCallback, useMemo, useState } from 'react';
import {
    FIRST_INDICATOR_PANE_INDEX,
    INACTIVE_PANE_INDEX,
} from '@/components/chart/constants';
import type { PaneIndices } from '@/components/chart/types';

interface UseIndicatorVisibilityReturn {
    rsiVisible: boolean;
    macdVisible: boolean;
    dmiVisible: boolean;
    stochasticVisible: boolean;
    stochRsiVisible: boolean;
    cciVisible: boolean;
    toggleRSI: () => void;
    toggleMACD: () => void;
    toggleDMI: () => void;
    toggleStochastic: () => void;
    toggleStochRSI: () => void;
    toggleCCI: () => void;
    paneIndices: PaneIndices;
}

export function useIndicatorVisibility(): UseIndicatorVisibilityReturn {
    const [rsiVisible, setRsiVisible] = useState(false);
    const [macdVisible, setMacdVisible] = useState(false);
    const [dmiVisible, setDmiVisible] = useState(false);
    const [stochasticVisible, setStochasticVisible] = useState(false);
    const [stochRsiVisible, setStochRsiVisible] = useState(false);
    const [cciVisible, setCciVisible] = useState(false);

    const paneIndices: PaneIndices = useMemo(() => {
        const visibles = [
            rsiVisible,
            macdVisible,
            dmiVisible,
            stochasticVisible,
            stochRsiVisible,
            cciVisible,
        ];
        const indexFor = (pos: number): number => {
            const precedingActive = visibles
                .slice(0, pos)
                .filter(Boolean).length;
            return visibles[pos]
                ? FIRST_INDICATOR_PANE_INDEX + precedingActive
                : INACTIVE_PANE_INDEX;
        };
        return {
            rsi: indexFor(0),
            macd: indexFor(1),
            dmi: indexFor(2),
            stochastic: indexFor(3),
            stochRsi: indexFor(4),
            cci: indexFor(5),
        };
    }, [
        rsiVisible,
        macdVisible,
        dmiVisible,
        stochasticVisible,
        stochRsiVisible,
        cciVisible,
    ]);

    const toggleRSI = useCallback(() => setRsiVisible(prev => !prev), []);
    const toggleMACD = useCallback(() => setMacdVisible(prev => !prev), []);
    const toggleDMI = useCallback(() => setDmiVisible(prev => !prev), []);
    const toggleStochastic = useCallback(
        () => setStochasticVisible(prev => !prev),
        []
    );
    const toggleStochRSI = useCallback(
        () => setStochRsiVisible(prev => !prev),
        []
    );
    const toggleCCI = useCallback(() => setCciVisible(prev => !prev), []);

    return {
        rsiVisible,
        macdVisible,
        dmiVisible,
        stochasticVisible,
        stochRsiVisible,
        cciVisible,
        toggleRSI,
        toggleMACD,
        toggleDMI,
        toggleStochastic,
        toggleStochRSI,
        toggleCCI,
        paneIndices,
    };
}
