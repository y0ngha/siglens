'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { getPeriodColor } from '@/shared/lib/chartColors';
import { GearIcon } from '@/shared/ui/GearIcon';
import {
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../model/indicatorRegistry';

interface IndicatorSettingsModalProps {
    bindings: IndicatorBinding[];
}

interface IndicatorRowProps {
    binding: IndicatorBinding;
}

const ROW_CLASS =
    'flex items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary-200';

function PeriodChips({ binding }: IndicatorRowProps) {
    const {
        availablePeriods = [],
        visiblePeriods = [],
        onTogglePeriod,
    } = binding;

    // 배열 includes를 map 안에서 반복하면 O(n*m) — Set으로 O(1) 조회.
    const visible = new Set(visiblePeriods);

    return (
        <div className="flex flex-wrap gap-1">
            {availablePeriods.map(period => {
                const selected = visible.has(period);
                return (
                    <button
                        key={period}
                        type="button"
                        onClick={() => onTogglePeriod?.(period)}
                        aria-pressed={selected}
                        className={cn(
                            'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            /* 선택 상태를 흰 글자로 표현하면 라이트 테마에서
                               secondary-700(거의 흰색) 위에 얹혀 사라진다.
                               두 테마에서 모두 최고 대비인 fg 토큰을 쓴다. */
                            selected
                                ? 'bg-secondary-700 text-secondary-50'
                                : 'text-secondary-400 hover:bg-secondary-700 hover:text-secondary-50'
                        )}
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--chip-color)]"
                            style={
                                {
                                    '--chip-color': getPeriodColor(period),
                                } as CSSProperties
                            }
                        />
                        {period}
                    </button>
                );
            })}
        </div>
    );
}

function PeriodRow({ binding }: IndicatorRowProps) {
    return (
        <div className={ROW_CLASS}>
            <span
                className={cn(
                    'w-16 shrink-0 font-medium',
                    binding.active ? 'text-secondary-50' : 'text-secondary-400'
                )}
            >
                {binding.meta.label}
            </span>
            <PeriodChips binding={binding} />
        </div>
    );
}

function ToggleRow({ binding }: IndicatorRowProps) {
    return (
        <label className={cn(ROW_CLASS, 'cursor-pointer')}>
            <input
                type="checkbox"
                checked={binding.active}
                // onToggle은 타입상 optional이라 undefined면 controlled input이
                // read-only가 되고 React 경고가 난다. no-op으로 controlled 유지.
                onChange={() => binding.onToggle?.()}
                className="h-4 w-4 accent-primary-500"
            />
            <span>{binding.meta.label}</span>
        </label>
    );
}

export function IndicatorSettingsModal({
    bindings,
}: IndicatorSettingsModalProps) {
    const t = useTranslations('widgets.chart');
    const tCategory = useTranslations('widgets.chart.indicatorCategory');
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();
    // 같은 페이지에 여러 차트가 렌더되어도 dialog title id가 충돌하지 않도록
    // 인스턴스별 고유 id를 생성한다 (aria-labelledby 무결성 보장).
    const titleId = useId();
    const groups = groupBindingsByCategory(bindings);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                aria-label={t('IndicatorSettingsModal.c6e1ca')}
                aria-haspopup="dialog"
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg bg-secondary-900/85 text-secondary-400 backdrop-blur-sm transition-colors hover:bg-secondary-700/90 hover:text-white focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <GearIcon className="h-4 w-4" />
            </button>

            {/* 네이티브 모달: 포커스 트랩·Esc·비활성 배경이 브라우저 기본 동작이다.
                차트 컨테이너의 stacking/overflow 밖으로 띄우기 위해 포털은 유지한다
                (top layer라 z-index 경쟁은 사라지지만, 부모의 overflow 클리핑은 남는다). */}
            {createPortal(
                <dialog
                    ref={dialogRef}
                    aria-labelledby={titleId}
                    onClose={close}
                    className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-secondary-700 bg-secondary-800 p-0 text-left shadow-2xl backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm"
                >
                    {isOpen && (
                        <div>
                            <div className="flex items-start justify-between border-b border-secondary-700 px-5 py-4">
                                <h2
                                    id={titleId}
                                    className="text-base font-semibold text-secondary-100"
                                >
                                    {t('IndicatorSettingsModal.c6e1ca')}
                                </h2>
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label={t(
                                        'IndicatorSettingsModal.94b7db'
                                    )}
                                    className="-mt-1 -mr-1 rounded p-1 text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 p-5">
                                {groups.map(group => (
                                    <section key={group.category}>
                                        <h3 className="mb-1 text-xs font-semibold text-secondary-500">
                                            {tCategory(group.labelKey)}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                            {group.items.map(binding =>
                                                binding.meta.hasPeriods ? (
                                                    <div
                                                        key={binding.meta.key}
                                                        className="col-span-2"
                                                    >
                                                        <PeriodRow
                                                            binding={binding}
                                                        />
                                                    </div>
                                                ) : (
                                                    <ToggleRow
                                                        key={binding.meta.key}
                                                        binding={binding}
                                                    />
                                                )
                                            )}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    )}
                </dialog>,
                document.body
            )}
        </>
    );
}
