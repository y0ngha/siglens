'use client';

import {
    useCallback,
    useState,
    type PointerEvent as ReactPointerEvent,
} from 'react';

interface UsePointerTooltipReturn {
    isVisible: boolean;
    toggle: () => void;
    handlePointerEnter: (e: ReactPointerEvent) => void;
    handlePointerLeave: (e: ReactPointerEvent) => void;
}

// Click으로 토글, 마우스 hover로 열고 닫음. 터치 기기는 hover 이벤트를 무시해 클릭만으로 토글한다.
export function usePointerTooltip(): UsePointerTooltipReturn {
    const [isVisible, setIsVisible] = useState(false);

    const toggle = useCallback((): void => setIsVisible(prev => !prev), []);

    const handlePointerEnter = useCallback((e: ReactPointerEvent): void => {
        if (e.pointerType === 'touch') return;
        setIsVisible(true);
    }, []);

    const handlePointerLeave = useCallback((e: ReactPointerEvent): void => {
        if (e.pointerType === 'touch') return;
        setIsVisible(false);
    }, []);

    return { isVisible, toggle, handlePointerEnter, handlePointerLeave };
}
