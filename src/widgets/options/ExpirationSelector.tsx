'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef, type KeyboardEvent } from 'react';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import type { SlotMapping } from '@y0ngha/siglens-core';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

interface ExpirationSelectorProps {
    /** Slot mappings filtered to non-null entries (`OptionsPageClient` filters before passing). */
    slots: ReadonlyArray<SlotMapping>;
    /** Current selection — an ISO 'YYYY-MM-DD' string or `'all'`. */
    value: OptionsExpirationSelector;
    onChange: (next: OptionsExpirationSelector) => void;
}

interface TabDescriptor {
    key: string;
    label: string;
    /** Selection value forwarded to `onChange`. */
    value: OptionsExpirationSelector;
    /** Optional secondary label (e.g. month-day slice). */
    sub?: string;
}

const CHIP_BASE =
    'focus-visible:ring-primary-500 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';
// `font-semibold`는 색이 아닌 단서다 — 활성/비활성이 보더·채움·글자색 셋 다
// 파랑 대 중립이라는 **색상 차이**로만 갈려 있어, 색각 이상 사용자에게는 세 단서가
// 동시에 무력해진다. 굵기는 그와 독립적으로 읽힌다.
//
// 굵기가 바뀌면 텍스트 폭이 달라져 같은 행의 형제 칩이 밀릴 수 있다. 칩 안에는
// 12px `tab.label`과 10px `tab.sub`(font-mono) 두 텍스트 노드가 있고, `sub`에는
// 굵기 클래스가 없어 **둘 다** 500→600 상승을 상속한다. 그래서 버튼 박스 전체를
// 기준으로 실측했다: 선택을 0번에서 2번으로 옮겼을 때 형제 이동 **최대 1px**,
// 버튼 박스 폭 변화 **0**. 두 노드 다 글자가 작아 글리프 폭 차이가 flex gap에
// 흡수된다. 지각 임계 아래이므로 폭을 따로 예약하지 않는다.
const CHIP_ACTIVE =
    'border-primary-500 bg-primary-500/10 font-semibold text-primary-400';
// 비활성 칩은 채움이 투명해 보더가 유일한 경계다. 장식용 `secondary-600`은
// 라이트에서 약 1.4:1이라 칩 모양 자체가 안 보인다 — 컨트롤 경계용 토큰을 쓴다
// (WCAG 1.4.11, `globals.css`의 `--color-border-control` 주석 참고).
const CHIP_INACTIVE =
    'border-border-control text-secondary-300 hover:border-primary-500 hover:text-primary-400';

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
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const tabs = useMemo<TabDescriptor[]>(
        () => [
            ...slots.map(({ slot, expirationDate }) => ({
                key: slot.key,
                label: slot.label,
                value: expirationDate,
                sub: expirationDate.slice(5),
            })),
            {
                key: 'all',
                label: t('ExpirationSelector.f7c86d'),
                value: 'all' as const,
            },
        ],
        [slots, t]
    );

    const activeIndex = useMemo(
        () =>
            Math.max(
                tabs.findIndex(t => t.value === value),
                0
            ),
        [tabs, value]
    );

    const focusTabAt = (index: number): void => {
        const normalized = (index + tabs.length) % tabs.length;
        const next = tabs[normalized];
        if (next === undefined) return;
        onChange(next.value);
        buttonRefs.current[normalized]?.focus();
    };

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number
    ): void => {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                focusTabAt(index + 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                focusTabAt(index - 1);
                break;
            case 'Home':
                event.preventDefault();
                focusTabAt(0);
                break;
            case 'End':
                event.preventDefault();
                focusTabAt(tabs.length - 1);
                break;
            default:
                break;
        }
    };

    return (
        <div
            className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-lg border border-secondary-700 bg-secondary-800 p-3"
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
            {tabs.map((tab, index) => {
                const active = index === activeIndex;
                return (
                    <button
                        key={tab.key}
                        ref={el => {
                            buttonRefs.current[index] = el;
                        }}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(tab.value)}
                        onKeyDown={e => handleKeyDown(e, index)}
                        className={cn(
                            CHIP_BASE,
                            active ? CHIP_ACTIVE : CHIP_INACTIVE
                        )}
                    >
                        <span>{tab.label}</span>
                        {tab.sub !== undefined && (
                            <span className="font-mono text-[10px] text-secondary-500">
                                {tab.sub}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
