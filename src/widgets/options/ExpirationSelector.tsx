'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';
import { useRovingKeyboardNav } from '@/shared/hooks/useRovingKeyboardNav';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
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
    // 슬롯 칩 라벨. core의 `slot.label`은 한국어로 하드코딩돼 있어(`1개월`) 영문 화면에
    // 그대로 나왔다 — 안정 식별자인 `slot.key`로 카탈로그를 찾는다.
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

    const tabs = useMemo<TabDescriptor[]>(
        () => [
            ...slots.map(({ slot, expirationDate }) => ({
                key: slot.key,
                // 모르는 키(core가 슬롯을 추가한 직후)는 core 라벨로 폴백한다.
                label: slotLabels[slot.key] ?? slot.label,
                value: expirationDate,
                sub: expirationDate.slice(5),
            })),
            {
                key: 'all',
                label: t('ExpirationSelector.f7c86d'),
                value: 'all' as const,
            },
        ],
        [slots, t, slotLabels]
    );

    const activeIndex = useMemo(
        () =>
            Math.max(
                tabs.findIndex(t => t.value === value),
                0
            ),
        [tabs, value]
    );

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
                        onKeyDown={handleKeyDown}
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
