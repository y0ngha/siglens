import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { FearGreedMetaFacts } from './fearGreedFacts';

/** 검색 결과 설명 상한(code point). 두 번째 문장이 안 들어가면 첫 문장만 쓴다. */
const DESCRIPTION_MAX_LENGTH = 160;

const PERIOD_KEY = {
    week: 'factsPeriodWeek',
    month: 'factsPeriodMonth',
    year: 'factsPeriodYear',
} as const;

/**
 * `애플(AAPL) 공포 탐욕 지수는 10월 2일 종가 기준 68점(탐욕)입니다. 1주 전 77점, 1개월 전
 * 66점이었고 최근 1년 동안 21~89점 사이에서 움직였습니다.`
 *
 * 종목마다 다른 사실(날짜·점수·과거 점수·범위)로만 만든 설명이다 — 예전 템플릿은 종목명만
 * 바뀌어 공포탐욕 탭 전체가 같은 설명을 냈다. `tSeo`는 `shared.seo` 번역자, `tLabel`은
 * `shared.enumLabel` 번역자다. 두 번째 문장이 예산을 넘으면 첫 문장만 쓴다(문장 중간을
 * 자르지 않는다).
 */
export function composeFearGreedDescription(
    facts: FearGreedMetaFacts,
    subject: string,
    tSeo: SeoTranslator,
    tLabel: EnumLabelTranslator
): string {
    const [, m, d] = facts.date.split('-');
    const date = tSeo('symbol.fearGreed.factsDate', {
        month: Number(m),
        day: Number(d),
    });
    const lead = tSeo('symbol.fearGreed.factsLead', {
        subject,
        date,
        score: facts.score,
        label: sentimentLabelText(facts.label, tLabel),
    });

    const past = facts.past
        .map(p =>
            tSeo('symbol.fearGreed.factsPast', {
                period: tSeo(`symbol.fearGreed.${PERIOD_KEY[p.period]}`),
                score: p.score,
            })
        )
        .join(tSeo('symbol.fearGreed.factsPastJoin'));
    const span =
        facts.range === null
            ? ''
            : facts.range.days === null
              ? tSeo('symbol.fearGreed.factsSpanYear')
              : tSeo('symbol.fearGreed.factsSpanDays', {
                    days: facts.range.days,
                });
    const rangeArgs =
        facts.range === null
            ? null
            : { span, min: facts.range.min, max: facts.range.max };

    const second =
        rangeArgs !== null && past !== ''
            ? tSeo('symbol.fearGreed.factsPastRange', { past, ...rangeArgs })
            : rangeArgs !== null
              ? tSeo('symbol.fearGreed.factsRangeOnly', rangeArgs)
              : past !== ''
                ? tSeo('symbol.fearGreed.factsPastOnly', { past })
                : '';

    // 문장 사이 공백은 로마자 종결부호(`.`) 뒤에서만 둔다 — 한·일·중 종결(`。`·`다.`)은 공백 없이
    // 이어 붙는 쪽이 자연스럽고, 로케일 카탈로그가 문장부호를 정한다.
    const gap = /[.!?]$/.test(lead) ? ' ' : '';
    const full = second === '' ? lead : `${lead}${gap}${second}`;
    return [...full].length <= DESCRIPTION_MAX_LENGTH ? full : lead;
}
