'use client';

/**
 * Shared tooltip JSX for options-page metrics.
 *
 * Multiple components surface the same metrics — `OptionsMetricsRow`
 * (options-tab grid), `OpenInterestChart` (OI distribution chart header),
 * and `OptionsChainTable` (chain table OI column) — so the explanation copy
 * must agree. Centralising the JSX here prevents silent drift when one site
 * is reworded and the others are forgotten.
 *
 * 대부분 const JSX fragment로 두지만, 한국 시간/DST에 따라 본문이 달라지는
 * 안내(ATM IV·Imp. Move)는 함수 컴포넌트로 둔다 — module-level const는 import
 * 시점에만 평가돼 DST 경계를 가로지르는 사용자에게 잘못된 시간을 보여준다.
 *
 * `'use client'`: `AtmIvTooltip`/`ImpliedMoveTooltip`은 `useHydrated()`로 마운트를
 * 감지한 뒤에만 `getEasternOffsetHours(new Date())`로 현재 DST 윈도우를 분기한다.
 * 마운트 전(SSR·첫 CSR)에는 고정 fallback(`KST_EDT_HOURS_DISPLAY`, 빈 label)을
 * 사용해 "지금은 …" DST 안내를 생략하므로 서버·클라 첫 렌더가 일치한다 —
 * React #418 하이드레이션 불일치 방지. RSC에서 import하면 hook을 쓸 수 없으므로
 * `'use client'` 강제.
 */

import { useTranslations } from 'next-intl';
import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';
import { EDT_OFFSET_HOURS, getEasternOffsetHours } from '@/shared/lib/eastern';
import {
    ET_MARKET_HOURS_DISPLAY,
    KST_EDT_HOURS_DISPLAY,
    KST_EST_HOURS_DISPLAY,
} from '@/shared/lib/options/marketHoursDisplay';
import { useHydrated } from '@/shared/hooks/useHydrated';

interface KstWindowInfo {
    hours: string;
    label: string;
}

export const MaxPainTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="maxPain" />
);

export const PutCallRatioTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="putCallRatio" />
);

/** `label`은 `widgets.options.dst` **키**다 — 표시는 호출부에서 `t()`로. */
function getCurrentKstWindow(): KstWindowInfo {
    const inEdt = getEasternOffsetHours(new Date()) === EDT_OFFSET_HOURS;
    return inEdt
        ? { hours: KST_EDT_HOURS_DISPLAY, label: 'edt' }
        : { hours: KST_EST_HOURS_DISPLAY, label: 'est' };
}

export function AtmIvTooltip() {
    const t = useTranslations('widgets.options');
    const isHydrated = useHydrated();
    // getCurrentKstWindow()는 new Date()를 호출하므로 마운트 후에만 실행한다.
    // SSR·첫 CSR 렌더에서 DST가 다르면 React #418 하이드레이션 불일치가 발생하므로 게이팅.
    const tDst = useTranslations('widgets.options.dst');
    const { hours: kstWindow, label } = isHydrated
        ? getCurrentKstWindow()
        : { hours: KST_EDT_HOURS_DISPLAY, label: '' };
    return (
        <>
            <p>{t('optionsTooltips.149b70')}</p>
            <p>{t('optionsTooltips.d9d063')}</p>
            <br />
            <p>
                <strong>{t('optionsTooltips.974bf0')}</strong>
                {t('optionsTooltips.2c2508', {
                    v0: kstWindow,
                    v1: ET_MARKET_HOURS_DISPLAY,
                })}
                {/* 현재 DST 레이블은 마운트 후에만 렌더 — React #418 방지 */}
                {isHydrated && tDst('currentPeriod', { v0: tDst(label) })}
            </p>
        </>
    );
}

export function ImpliedMoveTooltip() {
    const t = useTranslations('widgets.options');
    const isHydrated = useHydrated();
    // getCurrentKstWindow()는 new Date()를 호출하므로 마운트 후에만 실행한다.
    // SSR·첫 CSR 렌더에서 DST가 다르면 React #418 하이드레이션 불일치가 발생하므로 게이팅.
    const tDst = useTranslations('widgets.options.dst');
    const { hours: kstWindow, label } = isHydrated
        ? getCurrentKstWindow()
        : { hours: KST_EDT_HOURS_DISPLAY, label: '' };
    return (
        <>
            <p>{t('optionsTooltips.2eb007')}</p>
            <p>{t('optionsTooltips.f76775')}</p>
            <p>{t('optionsTooltips.f899ef')}</p>
            <br />
            <p>
                <strong>{t('optionsTooltips.974bf0')}</strong>
                {t('optionsTooltips.cc43f8', { v0: kstWindow })}
                {/* 현재 DST 레이블은 마운트 후에만 렌더 — React #418 방지 */}
                {isHydrated && tDst('currentPeriod', { v0: tDst(label) })}
            </p>
        </>
    );
}

export const OpenInterestTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="openInterest" />
);

export const CallOpenInterestTooltip = (
    <TooltipParagraphs
        namespace="widgets.options"
        tooltipKey="callOpenInterest"
    />
);

export const PutOpenInterestTooltip = (
    <TooltipParagraphs
        namespace="widgets.options"
        tooltipKey="putOpenInterest"
    />
);

export const CallVolumeTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="callVolume" />
);

export const PutVolumeTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="putVolume" />
);
