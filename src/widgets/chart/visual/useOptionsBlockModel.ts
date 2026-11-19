import { useTranslations } from 'next-intl';
import type { ChatOptionsBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { fixedNumber, NO_VALUE, plainNumber } from './format';

/** 옵션 탭 미결제약정 차트가 읽는 행 — 행사가별 콜·풋 합계. */
export interface ChatStrikeOpenInterest {
    strike: number;
    callOpenInterest: number;
    putOpenInterest: number;
}

export interface ChatOptionsModel {
    title: string;
    asOfText: string;
    /** 맥스페인·풋콜 비율 한 줄 — 차트 아래에 둔다. */
    summary: string;
    oiByStrike: ChatStrikeOpenInterest[];
}

/** 옵션 분포 블록을 옵션 탭 `OpenInterestChart` 입력과 요약 줄로 바꾼다. */
export function useOptionsBlockModel(
    block: ChatOptionsBlock
): ChatOptionsModel {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    return {
        title: t('ChatVisual.optionsTitle', {
            symbol: block.name ?? block.symbol,
            expiry: block.expiry,
        }),
        asOfText: t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) }),
        summary: t('ChatVisual.optionsSummary', {
            maxPain:
                block.maxPain === null
                    ? NO_VALUE
                    : plainNumber(block.maxPain, locale),
            ratio:
                block.putCallRatio === null
                    ? NO_VALUE
                    : fixedNumber(block.putCallRatio, 2, locale),
        }),
        oiByStrike: block.strikes
            .map(s => ({
                strike: s.strike,
                callOpenInterest: s.callOI,
                putOpenInterest: s.putOI,
            }))
            .toSorted((a, b) => a.strike - b.strike),
    };
}
