import { describe, expect, it } from 'vitest';
import {
    buildSymbolFearGreedSeoContent,
    buildSymbolNewsSeoContent,
    clampSeoDescription,
    SEO_TITLE_MAX_WIDTH,
    seoTitleWidth,
} from '../seo';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

/** 실제 카탈로그를 읽는 번역자 — 키가 빠지면 키 문자열이 나와 단언이 실패한다. */
function translator(messages: unknown) {
    return (key: string, values?: Record<string, string | number>) => {
        const raw = `shared.seo.${key}`
            .split('.')
            .reduce<unknown>(
                (node, seg) =>
                    node && typeof node === 'object'
                        ? (node as Record<string, unknown>)[seg]
                        : undefined,
                messages
            ) as string | undefined;
        if (raw === undefined) return key;
        return Object.entries(values ?? {}).reduce(
            (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
            raw
        );
    };
}

const tKo = translator(koMessages);
const TRADE_SIGNAL = /매수 분위기|매매 신호|매수세|매매 심리|단기 매수/;

describe('뉴스 탭 SERP 문구', () => {
    const news = buildSymbolNewsSeoContent('AAPL', tKo, {
        displayName: '애플, Apple Inc. (AAPL)',
        koreanName: '애플',
        locale: 'ko',
    });

    it('title 꼬리는 짧은 "주요 이슈·목표주가"이고 잘리지 않는다', () => {
        expect(news.title).toBe('애플(AAPL) 뉴스 — 주요 이슈·목표주가');
        expect(seoTitleWidth(news.title)).toBeLessThanOrEqual(
            SEO_TITLE_MAX_WIDTH
        );
    });

    it('description이 뉴스가 가격 원인이라고 단정하지 않고 신호 어휘도 없다', () => {
        expect(news.description).not.toContain('왜 움직였는지');
        expect(news.description).not.toMatch(TRADE_SIGNAL);
        expect([...news.description].length).toBeGreaterThanOrEqual(80);
        expect([...news.description].length).toBeLessThanOrEqual(160);
    });

    it('4개 로케일 카탈로그 모두 템플릿 description이 clamp 없이 120자 안이다', () => {
        for (const messages of [
            koMessages,
            enMessages,
            jaMessages,
            zhMessages,
        ]) {
            const text = translator(messages)('symbol.news.description', {
                subject: 'Apple Inc. (AAPL)',
            });
            expect(clampSeoDescription(text)).toBe(text);
        }
    });
});

describe('공포·탐욕 탭 SERP 문구', () => {
    const fg = buildSymbolFearGreedSeoContent('AAPL', tKo, {
        displayName: '애플, Apple Inc. (AAPL)',
        koreanName: '애플',
        locale: 'ko',
    });

    it('title 꼬리는 "0~100 점수와 최근 흐름"이고 55폭 안에 들어온다(길면 꼬리를 먼저 버린다)', () => {
        expect(fg.title).toBe(
            '애플(AAPL) 공포 탐욕 지수 — 0~100 점수와 최근 흐름'
        );
        expect(seoTitleWidth(fg.title)).toBeLessThanOrEqual(
            SEO_TITLE_MAX_WIDTH
        );
    });

    it('H1과 크로스링크 라벨에서 매매 신호 어휘를 뺐다(4개 로케일 카탈로그 포함)', () => {
        expect(koMessages.app.symbol.page['6cd32e']).toBe(
            '{v0} 공포 탐욕 지수 — 0~100 점수와 최근 흐름'
        );
        expect(koMessages.shared.crossLink.description['fear-greed']).toBe(
            '거래량·가격 위치로 본 0~100 점수'
        );
        for (const messages of [
            koMessages,
            enMessages,
            jaMessages,
            zhMessages,
        ]) {
            expect(messages.app.symbol.page['6cd32e']).not.toMatch(
                /매수|매매|[Bb]uying|買い|买入/
            );
            expect(
                messages.shared.crossLink.description['fear-greed']
            ).not.toMatch(/매매|매수|[Tt]rading sentiment|売買|交易情绪/);
        }
    });
});

describe('카탈로그 문구 정확성', () => {
    it('ja 뉴스 설명·꼬리에 `分位`가 없다(好材料・悪材料の雰囲気)', () => {
        expect(jaMessages.shared.seo.symbol.news.description).toContain(
            '雰囲気'
        );
        expect(JSON.stringify(jaMessages.shared.seo.symbol.news)).not.toContain(
            '分位'
        );
    });

    it('ko 방법론 문장은 명령형이 아니라 설명체(`셉니다`가 아닌 `세어요`)다', () => {
        const text = koMessages.views.methodology.fearGreed.episodes;
        expect(text).toContain('묶어서 세어요');
        expect(text).not.toMatch(/묶어 세요/);
    });

    it('거래량 지표 라벨은 평소 대비 이탈(등락 방향 반영)이고 증감이 아니다', () => {
        for (const messages of [
            koMessages,
            enMessages,
            jaMessages,
            zhMessages,
        ]) {
            expect(
                messages.shared.lib.fearGreedFactor.symbolLabel.volume_z
            ).not.toMatch(/증감|increase|增减|増減/i);
        }
        expect(koMessages.shared.lib.fearGreedFactor.symbolLabel.volume_z).toBe(
            '평소 대비 거래량 이탈(등락 방향 반영)'
        );
    });

    it('점수 창 문구는 "최근 약 5년"이 아니라 실제 쓰인 과거 값(최대 약 5년)이다', () => {
        expect(koMessages.views.methodology.fearGreed.how).toContain(
            '과거 값(최대 약 5년)'
        );
        expect(
            koMessages.views.symbol.fearGreedFacts.factorTableCaption
        ).toContain('과거 값(최대 약 5년)');
        expect(koMessages.shared.seo.symbol.fearGreed.titleTail).toBe(
            '0~100 점수와 최근 흐름'
        );
    });
});
