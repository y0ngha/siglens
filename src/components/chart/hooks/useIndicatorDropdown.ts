'use client';

import { useMemo, useRef, useState, type RefObject } from 'react';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';

export type IndicatorDropdownType = 'ma' | 'ema';
export type DropdownType = IndicatorDropdownType | null;

export interface DropdownPosition {
    top: number;
    left: number;
}

interface UseIndicatorDropdownReturn {
    isExpanded: boolean;
    openDropdown: DropdownType;
    dropdownPosition: DropdownPosition | null;
    toolbarRef: RefObject<HTMLDivElement | null>;
    portalRef: RefObject<HTMLDivElement | null>;
    buttonRefs: Record<
        IndicatorDropdownType,
        RefObject<HTMLButtonElement | null>
    >;
    toggleExpanded: () => void;
    toggleDropdown: (type: IndicatorDropdownType) => void;
}

const DROPDOWN_OFFSET_PX = 4;

export function useIndicatorDropdown(): UseIndicatorDropdownReturn {
    const [isExpanded, setIsExpanded] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
    const [dropdownPosition, setDropdownPosition] =
        useState<DropdownPosition | null>(null);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const maButtonRef = useRef<HTMLButtonElement>(null);
    const emaButtonRef = useRef<HTMLButtonElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(toolbarRef, event => {
        if (!openDropdown) return;
        const isInsidePortal = portalRef.current?.contains(
            event.target as Node
        );
        if (!isInsidePortal) setOpenDropdown(null);
    });

    const buttonRefs = useMemo(
        () => ({ ma: maButtonRef, ema: emaButtonRef }),
        []
    );

    const toggleExpanded = (): void => {
        setIsExpanded(prev => !prev);
        if (openDropdown) setOpenDropdown(null);
    };

    const toggleDropdown = (type: IndicatorDropdownType): void => {
        if (openDropdown === type) {
            setOpenDropdown(null);
            return;
        }
        const buttonRef = buttonRefs[type];
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom + window.scrollY + DROPDOWN_OFFSET_PX,
            left: rect.left + window.scrollX,
        });
        setOpenDropdown(type);
    };

    return {
        isExpanded,
        openDropdown,
        dropdownPosition,
        toolbarRef,
        portalRef,
        buttonRefs,
        toggleExpanded,
        toggleDropdown,
    };
}
