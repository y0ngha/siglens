'use client';

/**
 * 확장 시세 한 줄 캡션의 표시 모델 훅 — 조회·번역·포맷을 모아 UI가 문자열만 그리게 한다.
 */

import { useTranslations } from 'next-intl';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import type { ExtendedSessionKind } from '@/entities/extended-hours/model';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatPrice } from '@/shared/lib/priceFormat';
import {
    describeExtendedMove,
    EXTENDED_HOURS_PRICE_FORMAT,
    type ExtendedMoveDirection,
    type ExtendedMoveDisplay,
} from '../utils/extendedMove';
import { formatTradeTime } from '../utils/formatTradeTime';

/** 캡션 한 줄에 들어가는 문자열과 등락 표시. */
export interface ExtendedHoursLineView {
    /** 보이는 세션 라벨(프리마켓·애프터마켓). */
    sessionLabel: string;
    /** 등락 기준 문구 — 프리마켓은 직전 세션 종가, 애프터마켓은 오늘 정규장 종가. */
    basisLabel: string;
    /** 체결가(`$346.38`). */
    priceText: string;
    /** 등락 금액·%와 방향. */
    move: ExtendedMoveDisplay;
    /** 방향 단어(상승·하락·보합) — 색·화살표만으로 방향을 전하지 않도록 sr-only로 읽힌다. */
    moveLabel: string;
    /** 툴팁의 체결 시각 문구(`07:07 ET 체결`). */
    tradedAtText: string;
}

/**
 * 지금 확장 세션이고 값이 있으면 캡션 표시 모델을, 아니면 `null`을 돌려준다
 * (조회 조건·폴링은 `useExtendedHoursQuote`가 소유한다).
 */
export function useExtendedHoursLine(
    symbol: string
): ExtendedHoursLineView | null {
    const t = useTranslations('widgets.extended-hours');
    const tMove = useTranslations('shared.lib.priceMove');
    const locale = useResolvedLocale();
    const quote = useExtendedHoursQuote(symbol);
    if (quote === null) return null;

    const sessionLabels: Record<
        ExtendedSessionKind,
        { session: string; basis: string }
    > = {
        'pre-market': { session: t('sessionPre'), basis: t('basisPre') },
        'after-hours': { session: t('sessionAfter'), basis: t('basisAfter') },
    };
    const moveLabels: Record<ExtendedMoveDirection, string> = {
        up: tMove('up'),
        down: tMove('down'),
        flat: t('flat'),
    };
    const { session, basis } = sessionLabels[quote.session];
    const move = describeExtendedMove(quote.change, quote.changePercent);

    return {
        sessionLabel: session,
        basisLabel: basis,
        priceText: formatPrice(quote.price, EXTENDED_HOURS_PRICE_FORMAT),
        move,
        moveLabel: moveLabels[move.direction],
        tradedAtText: t('tradedAt', {
            time: formatTradeTime(quote.tradedAtMs, locale),
        }),
    };
}
