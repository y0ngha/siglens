'use client';

/**
 * Expiration tab strip (WAI-ARIA tabs) for the options tab. Tab building lives
 * in `utils/expirationTabs`, chip markup in `ui/expiration`.
 */

import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';
import { useRovingKeyboardNav } from '@/shared/hooks/useRovingKeyboardNav';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import {
    buildExpirationTabs,
    findActiveTabIndex,
} from './utils/expirationTabs';
import { ExpirationChip } from './ui/expiration/ExpirationChip';
import type { ExpirationSlotKey, SlotMapping } from '@y0ngha/siglens-core';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface ExpirationSelectorProps {
    /** Slot mappings filtered to non-null entries (`OptionsPageClient` filters before passing). */
    slots: ReadonlyArray<SlotMapping>;
    /** Current selection — an ISO 'YYYY-MM-DD' string or `'all'`. */
    value: OptionsExpirationSelector;
    onChange: (next: OptionsExpirationSelector) => void;
}

/**
 * Tab-style expiration selector. Implements the WAI-ARIA tabs pattern:
 * roving `tabIndex` (active tab is `0`, others `-1`) and Left/Right/Home/End
 * key navigation. Selecting a chip immediately fires `onChange` (automatic
 * activation, consistent with the existing SymbolTabs pattern in this app).
 */
export function ExpirationSelector({
    slots,
    value,
    onChange,
}: ExpirationSelectorProps) {
    const t = useTranslations('widgets.options');
    // 슬롯 칩 라벨. core의 `slot.label`은 한국어로 하드코딩돼 있어(`1개월`) 영문 화면에
    // 그대로 나오므로 안정 식별자인 `slot.key`로 카탈로그를 찾는다.
    //
    // 키를 변수로 조립하지 않고 리터럴 호출을 정적 맵에 펼쳐 둔다. 동적 키는 추출기가
    // 네임스페이스를 통째로 넓히거나(클라이언트 페이로드 부풀림) 키를 빠뜨려 전 로케일이
    // 한국어로 렌더되게 한다(`shared/i18n/assetLabel.ts` 주석). `Record<ExpirationSlotKey, …>`라
    // core가 슬롯을 추가하면 컴파일이 막는다.
    const slotLabels = useMemo<Record<ExpirationSlotKey, string>>(
        () => ({
            '0D': t('ExpirationSelector.slot0D'),
            '1W': t('ExpirationSelector.slot1W'),
            '2W': t('ExpirationSelector.slot2W'),
            '1M': t('ExpirationSelector.slot1M'),
            '2M': t('ExpirationSelector.slot2M'),
            '3M': t('ExpirationSelector.slot3M'),
            '6M': t('ExpirationSelector.slot6M'),
        }),
        [t]
    );
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const allLabel = t('ExpirationSelector.f7c86d');
    const tabs = useMemo(
        () => buildExpirationTabs(slots, slotLabels, allLabel),
        [slots, slotLabels, allLabel]
    );
    const activeIndex = findActiveTabIndex(tabs, value);

    const values = tabs.map(tab => tab.value);
    const handleKeyDown = useRovingKeyboardNav({
        items: values,
        activeItem: values[activeIndex]!,
        onChange,
        focusItem: next => buttonRefs.current[values.indexOf(next)]?.focus(),
    });

    return (
        <div
            className={cn(
                SURFACE_CARD,
                'flex flex-wrap items-center gap-2 overflow-x-auto p-3'
            )}
            role="tablist"
            aria-label={t('ExpirationSelector.15dbc6')}
        >
            <span className="mr-1 text-xs tracking-[0.01em] text-secondary-400">
                {t('ExpirationSelector.ef6fe0')}
                <InfoTooltip>
                    <p>{t('ExpirationSelector.88dc87')}</p>
                    <p>{t('ExpirationSelector.c94421')}</p>
                </InfoTooltip>
            </span>
            {tabs.map((tab, index) => (
                <ExpirationChip
                    key={tab.key}
                    tab={tab}
                    active={index === activeIndex}
                    buttonRef={el => {
                        buttonRefs.current[index] = el;
                    }}
                    onSelect={() => onChange(tab.value)}
                    onKeyDown={handleKeyDown}
                />
            ))}
        </div>
    );
}
