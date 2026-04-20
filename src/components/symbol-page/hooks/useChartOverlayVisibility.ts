'use client';

import {
    useCallback,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';

interface UseChartOverlayVisibilityReturn {
    chartVisiblePatterns: Set<string>;
    keyLevelsVisible: boolean;
    setKeyLevelsVisible: Dispatch<SetStateAction<boolean>>;
    trendlinesVisible: boolean;
    setTrendlinesVisible: Dispatch<SetStateAction<boolean>>;
    actionPricesVisible: boolean;
    setActionPricesVisible: Dispatch<SetStateAction<boolean>>;
    handlePatternOverlayChange: (
        visiblePatterns: Set<string>,
        toggle: (patternName: string) => void
    ) => void;
    handleTogglePattern: (patternName: string) => void;
}

export function useChartOverlayVisibility(): UseChartOverlayVisibilityReturn {
    const [chartVisiblePatterns, setChartVisiblePatterns] = useState<
        Set<string>
    >(new Set());
    const [keyLevelsVisible, setKeyLevelsVisible] = useState(false);
    const [trendlinesVisible, setTrendlinesVisible] = useState(false);
    const [actionPricesVisible, setActionPricesVisible] = useState(true);
    const togglePatternRef = useRef<(patternName: string) => void>(
        () => undefined
    );

    const handlePatternOverlayChange = useCallback(
        (
            visiblePatterns: Set<string>,
            toggle: (patternName: string) => void
        ): void => {
            setChartVisiblePatterns(visiblePatterns);
            togglePatternRef.current = toggle;
        },
        []
    );

    const handleTogglePattern = useCallback((patternName: string): void => {
        togglePatternRef.current(patternName);
    }, []);

    return {
        chartVisiblePatterns,
        keyLevelsVisible,
        setKeyLevelsVisible,
        trendlinesVisible,
        setTrendlinesVisible,
        actionPricesVisible,
        setActionPricesVisible,
        handlePatternOverlayChange,
        handleTogglePattern,
    };
}
