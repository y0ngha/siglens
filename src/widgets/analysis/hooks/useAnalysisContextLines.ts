'use client';

import { useTranslations } from 'next-intl';
import type { AnalysisResponse, Trend } from '@y0ngha/siglens-core';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    buildAnalysisContextModel,
    selectContextLines,
    type ContextLine,
    type ContextLineKey,
} from '../utils/higherTimeframeContext';

export interface ContextText {
    /** React key로 쓴다. */
    key: ContextLineKey;
    text: string;
}

/**
 * 상위 시간대 읽기와 시장 배경을 화면(결론 카드)과 복사 리포트가 같이 쓰는 문장 줄로 만든다.
 *
 * 줄마다 완결된 한 문장이다(번역 조각을 이어 붙이지 않는다, `I18N.md#I18-14`). 어떤 줄을 낼지는 순수 함수
 * `selectContextLines`가 정하고, 이 훅은 번역과 서식만 맡는다. 값이 없는 줄은 빠진 줄이라 옛 결과(필드 없음)는
 * 빈 배열이다. 설명만 하고 권유하지 않는다: 정렬이 좋다 나쁘다를 말하지 않고 진입·청산 표현도 쓰지 않는다.
 * 번역 키는 모두 이 파일에서 리터럴로 부른다(추출기가 보는 곳, `I18N.md#I18-16`).
 *
 * @param symbol - 분석한 종목. 변화율 줄에는 거래소 접미사(`.KS`/`.KQ`)를 뗀 표시 코드로 찍는다.
 */
export function useAnalysisContextLines(
    analysis: Pick<
        AnalysisResponse,
        'higherTimeframe' | 'marketBackdrop' | 'dataAsOf'
    >,
    symbol: string
): ContextText[] {
    const t = useTranslations('widgets.analysis.conclusion');
    const locale = useResolvedLocale();

    const model = buildAnalysisContextModel(analysis);
    if (model === null) return [];

    const KIND_WORD = {
        daily: t('kindDaily'),
        weekly: t('kindWeekly'),
        monthly: t('kindMonthly'),
    } as const;
    const TREND_WORD: Record<Trend, string> = {
        bullish: t('trendWordBullish'),
        bearish: t('trendWordBearish'),
        neutral: t('trendWordNeutral'),
    };
    const ticker = symbol.toUpperCase().replace(KR_EXCHANGE_SUFFIX_RE, '');

    const dateText = (date: string): string =>
        new Intl.DateTimeFormat(locale, {
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(`${date}T00:00:00Z`));

    const textOf = (line: ContextLine): string => {
        switch (line.key) {
            case 'htfTrend':
                return t('htfTrend', {
                    v0: KIND_WORD[line.params.kind],
                    v1: TREND_WORD[line.params.trend],
                });
            case 'htfAligned':
                return t('htfAligned', {
                    v0: KIND_WORD[line.params.kind],
                    v1: TREND_WORD[line.params.trend],
                });
            case 'htfOpposed':
                return t('htfOpposed', {
                    v0: KIND_WORD[line.params.kind],
                    v1: TREND_WORD[line.params.trend],
                });
            case 'htfMixed':
                return t('htfMixed', {
                    v0: KIND_WORD[line.params.kind],
                    v1: TREND_WORD[line.params.trend],
                });
            case 'htfUnknown':
                return t('htfUnknown', { v0: KIND_WORD[line.params.kind] });
            case 'progressDaily':
                return t('progressDaily');
            case 'progressWeekly':
                return t('progressWeekly');
            case 'progressMonthly':
                return t('progressMonthly');
            case 'marketTrend':
                return t('marketTrend', {
                    v0: line.params.label,
                    v1: TREND_WORD[line.params.trend],
                });
            case 'marketUnknown':
                return t('marketUnknown', { v0: line.params.label });
            case 'marketBasis':
                return t('marketBasis', { v0: dateText(line.params.date) });
            case 'marketChange':
                return t('marketChange', {
                    v0: line.params.sessions,
                    v1: line.params.ticker,
                    v2: line.params.symbolPct,
                    v3: line.params.benchmarkPct,
                });
        }
    };

    return selectContextLines(model, ticker).map(line => ({
        key: line.key,
        text: textOf(line),
    }));
}
