/**
 * 숏스퀴즈 점수의 구성요소 한 줄 — 이름·원값, 점수 기여분, 0~1 정규화 값 막대.
 */
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { SqueezeRiskComponent } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatInteger } from '../../utils/flowFormat';
import { PERCENT_SCALE } from '../../utils/percentScale';
import { formatComponentValue } from '../../utils/squeeze';

interface ComponentRowProps {
    readonly component: SqueezeRiskComponent;
    readonly label: string;
}

/** 막대는 장식(`aria-hidden`)이고, 같은 정보는 원값·점수 글자로도 전한다. */
export function ComponentRow({ component, label }: ComponentRowProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { unit, value } = formatComponentValue(
        component.id,
        component.value,
        locale
    );
    // 퍼센트 값은 포맷이 이미 `%`를 붙인다. 나머지 단위 글자는 로케일마다 다르다.
    const unitLabels = {
        percent: value,
        signedPercent: value,
        days: t('squeeze.unit.days', { value }),
        tradingDays: t('squeeze.unit.tradingDays', { value }),
        notListed: t('squeeze.unit.notListed'),
        z: t('squeeze.unit.z', { value }),
        multiple: t('squeeze.unit.multiple', { value }),
    };
    // 안전한 캐스트: 값은 이 파일이 만든 `%` 문자열 하나뿐이다(TW-1 — 동적 폭은 CSS 변수로).
    const barStyle = {
        '--bar-w': `${Math.round(Math.min(1, Math.max(0, component.normalized)) * PERCENT_SCALE)}%`,
    } as CSSProperties;
    return (
        <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="min-w-0 text-xs text-secondary-300">
                {label}
                <span className="ml-1 text-secondary-400 tabular-nums">
                    {unitLabels[unit]}
                </span>
            </span>
            <span className="text-xs text-secondary-200 tabular-nums">
                {t('squeeze.points', {
                    points: formatInteger(component.contribution, locale),
                })}
            </span>
            <span
                aria-hidden="true"
                className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary-700"
            >
                <span
                    style={barStyle}
                    className="block h-full w-(--bar-w) rounded-full bg-primary-400"
                />
            </span>
        </li>
    );
}
