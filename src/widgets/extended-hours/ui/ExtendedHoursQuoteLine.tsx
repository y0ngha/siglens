'use client';

import { useTranslations } from 'next-intl';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatPrice, formatPriceChange } from '@/shared/lib/priceFormat';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { formatTradeTime } from '../utils/formatTradeTime';

interface ExtendedHoursQuoteLineProps {
    symbol: string;
}

const US_PRICE_FORMAT = getDescriptor('us-equity').priceFormat;

/**
 * 미국 주식 프리마켓/애프터마켓 한 줄 시세 알약. 확장 세션이 아니거나 값이 없으면 **아무것도
 * 그리지 않는다**(`null`) — E2E·키 없음·장애·휴장일이 모두 이 경로다.
 *
 * 자리는 호출부(`ChartContent`의 `chartCornerSlot`)가 절대 위치로 정한다. 이 컴포넌트는 흐름에서
 * 공간을 차지하는 형제로 두지 않는다 — 그래서 나타나도 제목 `h1`·차트 행이 움직이지 않는다.
 * 폭이 모자라면 말줄임(`truncate`)하고, 래퍼(컨테이너 쿼리 기준)가 9rem보다 좁으면 통째로 숨긴다. 알약만 포인터를 받는다(`pointer-events-auto`) — 래퍼는
 * 통과시켜 차트 조작을 막지 않는다.
 *
 * 등락 기준(`basis*`)은 프리마켓이면 직전 세션 종가, 애프터마켓이면 오늘 정규장 종가다.
 * - 스크린리더: 알약 맨 앞 `sr-only` 문구.
 * - sm 이상: 가격 뒤에 보이는 라벨.
 * - sm 미만(터치): 라벨 옆 ⓘ(`InfoTooltip`)를 눌러 본다 — 폭을 아끼면서 hover 없이도 같은 정보를 준다.
 * 색만으로 방향을 전하지 않도록 화살표와 상승/하락 단어를 함께 둔다.
 */
export function ExtendedHoursQuoteLine({
    symbol,
}: ExtendedHoursQuoteLineProps) {
    const t = useTranslations('widgets.extended-hours');
    const tMove = useTranslations('shared.lib.priceMove');
    const locale = useResolvedLocale();
    const quote = useExtendedHoursQuote(symbol);
    if (quote === null) return null;

    const { sign, colorClass, arrow, arrowLabelKey } = formatPriceChange(
        quote.changePercent
    );
    const isPre = quote.session === 'pre-market';
    const basis = isPre ? t('basisPre') : t('basisAfter');
    const absChange = formatPrice(Math.abs(quote.change), US_PRICE_FORMAT);

    return (
        <span
            data-testid="extended-hours-quote"
            className="pointer-events-auto hidden max-w-full truncate rounded-lg border border-secondary-700 bg-secondary-800/90 px-2 py-0.5 font-mono text-xs text-secondary-300 tabular-nums @min-[9rem]:block"
        >
            <span className="sr-only">{basis}</span>
            <span className="font-sans text-secondary-400">
                {isPre ? t('sessionPre') : t('sessionAfter')}
            </span>
            <span className="sm:hidden">
                <InfoTooltip>{basis}</InfoTooltip>
            </span>{' '}
            <span className="text-secondary-100">
                {formatPrice(quote.price, US_PRICE_FORMAT)}
            </span>{' '}
            <span className={colorClass}>
                <span aria-hidden="true">{arrow}</span>
                <span className="sr-only">{tMove(arrowLabelKey)}</span>
                <span className="hidden sm:inline">
                    {sign === '+' ? '+' : '-'}
                    {absChange}{' '}
                </span>
                {`${sign}${quote.changePercent.toFixed(2)}%`}
            </span>
            <span
                data-testid="extended-hours-basis"
                className="hidden font-sans text-secondary-400 sm:inline"
            >
                {' '}
                {basis}
            </span>
            <span className="hidden text-secondary-400 sm:inline">
                {' '}
                {t('tradedAt', {
                    time: formatTradeTime(quote.tradedAtMs, locale),
                })}
            </span>
        </span>
    );
}
