import { describe, it, expect } from 'vitest';
import type { FearGreedLabel } from '@y0ngha/siglens-core';
import {
    buildFearGreedMetaFacts,
    scoredHistory,
} from '../utils/fearGreedFacts';
import { composeFearGreedDescription } from '../utils/fearGreedMetaDescription';
import { createTranslator } from 'next-intl';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

/** 실제 ko 카탈로그를 읽는 번역자 — 키가 빠지면 키 문자열이 나와 단언이 실패한다. */
function translator(root: unknown) {
    return (key: string, values?: Record<string, string | number>) => {
        const raw = key
            .split('.')
            .reduce<unknown>(
                (node, seg) =>
                    node && typeof node === 'object'
                        ? (node as Record<string, unknown>)[seg]
                        : undefined,
                root
            ) as string | undefined;
        if (raw === undefined) return key;
        return Object.entries(values ?? {}).reduce(
            (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
            raw
        );
    };
}

const tSeo = translator(koMessages.shared.seo);
const tLabel = translator(koMessages.shared.enumLabel);

function labelOf(score: number): FearGreedLabel {
    if (score < 25) return 'EXTREME_FEAR';
    if (score < 45) return 'FEAR';
    if (score < 55) return 'NEUTRAL';
    if (score < 75) return 'GREED';
    return 'EXTREME_GREED';
}

/** 마지막 날짜가 2026-10-02인 시계열. */
function history(scores: number[]) {
    const end = Date.UTC(2026, 9, 2);
    return scores.map((score, i) => ({
        date: new Date(end - (scores.length - 1 - i) * 86_400_000)
            .toISOString()
            .slice(0, 10),
        score,
        label: labelOf(score),
    }));
}

describe('buildFearGreedMetaFacts', () => {
    it('점수가 하나도 없으면 null(템플릿 설명으로 떨어진다)', () => {
        expect(buildFearGreedMetaFacts([])).toBeNull();
    });

    it('현재 점수·1주/1개월/1년 전·1년 범위를 본문 시계열 문장과 같은 기준으로 담는다', () => {
        const scores = Array.from({ length: 260 }, () => 50);
        scores[259] = 68;
        scores[259 - 5] = 77;
        scores[259 - 21] = 66;
        scores[259 - 252] = 40;
        scores[100] = 21;
        scores[200] = 89;

        const facts = buildFearGreedMetaFacts(scoredHistory(history(scores)))!;

        expect(facts.date).toBe('2026-10-02');
        expect(facts.score).toBe(68);
        expect(facts.label).toBe('GREED');
        expect(facts.past).toEqual([
            { period: 'week', score: 77 },
            { period: 'month', score: 66 },
            { period: 'year', score: 40 },
        ]);
        expect(facts.range).toEqual({ min: 21, max: 89, days: null });
    });

    it('표본이 60개 미만이면 범위를 말하지 않고, 짧은 시계열은 확보된 시점만 담는다', () => {
        const facts = buildFearGreedMetaFacts(
            scoredHistory(history(Array.from({ length: 10 }, () => 50)))
        )!;

        expect(facts.past.map(p => p.period)).toEqual(['week']);
        expect(facts.range).toBeNull();
    });
});

describe('composeFearGreedDescription', () => {
    function factsFor(scores: number[]) {
        return buildFearGreedMetaFacts(scoredHistory(history(scores)))!;
    }

    it('종목마다 다른 사실(날짜·점수·과거 점수·범위)로 두 문장을 만든다', () => {
        const scores = Array.from({ length: 260 }, () => 50);
        scores[259] = 68;
        scores[259 - 5] = 77;
        scores[259 - 21] = 66;
        scores[259 - 252] = 40;
        scores[100] = 21;
        scores[200] = 89;

        expect(
            composeFearGreedDescription(
                factsFor(scores),
                '애플(AAPL)',
                tSeo,
                tLabel
            )
        ).toBe(
            '애플(AAPL) 공포 탐욕 지수는 10월 2일 종가 기준 68점(탐욕)입니다. 1주 전 77점, 1개월 전 66점, 1년 전 40점이었고 최근 1년 동안 21~89점 사이에서 움직였습니다.'
        );
    });

    it('범위가 없으면 과거 점수만, 과거 점수가 없으면 첫 문장만 말한다', () => {
        const short = composeFearGreedDescription(
            factsFor(Array.from({ length: 10 }, () => 50)),
            '애플(AAPL)',
            tSeo,
            tLabel
        );
        expect(short).toContain('1주 전 50점이었습니다.');
        expect(short).not.toContain('사이에서');

        const single = composeFearGreedDescription(
            factsFor([50, 51, 52]),
            '애플(AAPL)',
            tSeo,
            tLabel
        );
        expect(single).toBe(
            '애플(AAPL) 공포 탐욕 지수는 10월 2일 종가 기준 52점(중립)입니다.'
        );
    });

    it('160자를 넘기면 문장 중간을 자르지 않고 첫 문장만 쓴다', () => {
        const scores = Array.from({ length: 260 }, () => 50);
        const description = composeFearGreedDescription(
            factsFor(scores),
            '아주 긴 이름의 종목'.repeat(8),
            tSeo,
            tLabel
        );
        expect(description.endsWith('입니다.')).toBe(true);
        expect(description).not.toContain('움직였습니다');
    });

    it('매매 신호 어휘를 쓰지 않는다', () => {
        const scores = Array.from({ length: 260 }, () => 60);
        const description = composeFearGreedDescription(
            factsFor(scores),
            '애플(AAPL)',
            tSeo,
            tLabel
        );
        expect(description).not.toMatch(/매수|매도|매매/);
    });
});

/**
 * 다른 로케일은 실제 ICU 렌더(`createTranslator`)로 읽는다 — 단순 치환 번역자는 en의 월 이름
 * `select`를 못 풀어 문장이 어색한 채로 통과한다.
 */
describe('composeFearGreedDescription — 로케일별 문장', () => {
    const scores = Array.from({ length: 260 }, () => 50);
    scores[259] = 68;
    scores[259 - 5] = 77;
    scores[259 - 21] = 66;
    scores[259 - 252] = 40;
    scores[100] = 21;
    scores[200] = 89;
    const facts = buildFearGreedMetaFacts(scoredHistory(history(scores)))!;

    function render(
        locale: 'en' | 'ja' | 'zh',
        messages: unknown,
        subject: string,
        input = facts
    ) {
        const m = messages as Parameters<
            typeof createTranslator
        >[0]['messages'];
        const tSeo = createTranslator({
            locale,
            messages: m,
            namespace: 'shared.seo',
        }) as unknown as Parameters<typeof composeFearGreedDescription>[2];
        const tEnum = createTranslator({
            locale,
            messages: m,
            namespace: 'shared.enumLabel',
        }) as unknown as Parameters<typeof composeFearGreedDescription>[3];
        return composeFearGreedDescription(input, subject, tSeo, tEnum);
    }

    it('en: 과거 점수를 "Past scores:"로 나열하고 범위는 별도 문장이다(160자 안)', () => {
        const text = render('en', enMessages, 'AAPL');

        expect(text).toBe(
            'AAPL Fear & Greed Index: 68 (Greed) at the Oct 2 close. Past scores: 1 week ago 77, 1 month ago 66, 1 year ago 40. Range over the past year: 21 to 89.'
        );
        expect(text).not.toMatch(/It was/);
        expect([...text].length).toBeLessThanOrEqual(160);
    });

    it('en: 과거 점수만 있을 때와 범위만 있을 때도 문장이 선다', () => {
        const shortFacts = buildFearGreedMetaFacts(
            scoredHistory(history(Array.from({ length: 10 }, () => 50)))
        )!;
        expect(render('en', enMessages, 'AAPL', shortFacts)).toContain(
            'Past scores: 1 week ago 50.'
        );
    });

    it('ja: 날짜·점수·과거 점수·범위를 자연스러운 문장으로 잇는다', () => {
        expect(render('ja', jaMessages, 'アップル(AAPL)')).toBe(
            'アップル(AAPL)の恐怖・強欲指数は10月2日の終値時点で68点（強欲）です。1週間前77点、1か月前66点、1年前40点で、直近1年間は21〜89点の間で推移しました。'
        );
    });

    it('zh: 날짜·점수·과거 점수·범위를 자연스러운 문장으로 잇는다', () => {
        expect(render('zh', zhMessages, '苹果(AAPL)')).toBe(
            '苹果(AAPL)的恐惧与贪婪指数截至10月2日收盘为68分（贪婪）。1周前77分，1个月前66分，1年前40分，近1年在21~89分之间波动。'
        );
    });
});
