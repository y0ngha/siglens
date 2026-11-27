import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import type { MailAlertItem, MailAlertTopic } from '../../model';
import {
    parseTopicInput,
    rowToTopic,
    suppressionKey,
    topicToRow,
} from '../topics';

describe('topicToRow / rowToTopic', () => {
    const topics: MailAlertTopic[] = [
        { kind: 'symbol', symbol: 'AAPL' },
        { kind: 'symbol', symbol: '005930.KS' },
        { kind: 'signal', signalType: 'golden_cross' },
        { kind: 'fear_greed', market: 'crypto' },
    ];

    it.each(topics)('%o는 행으로 바꿨다 되돌려도 같다', topic => {
        expect(rowToTopic(topicToRow(topic))).toEqual(topic);
    });

    it('종류별로 key에 담는 값이 정해져 있다', () => {
        expect(topicToRow({ kind: 'symbol', symbol: 'AAPL' })).toEqual({
            kind: 'symbol',
            key: 'AAPL',
        });
        expect(
            topicToRow({ kind: 'signal', signalType: 'new_52w_high' })
        ).toEqual({ kind: 'signal', key: 'new_52w_high' });
        expect(topicToRow({ kind: 'fear_greed', market: 'us' })).toEqual({
            kind: 'fear_greed',
            key: 'us',
        });
    });

    it('모르는 종류와 값은 null이다', () => {
        expect(rowToTopic({ kind: 'price_level', key: 'AAPL' })).toBeNull();
        expect(
            rowToTopic({ kind: 'signal', key: 'bollinger_squeeze' })
        ).toBeNull();
        expect(rowToTopic({ kind: 'fear_greed', key: 'eu' })).toBeNull();
    });

    it('정규형이 아닌 심볼 행(소문자·공백·잘못된 모양)은 null이다', () => {
        expect(rowToTopic({ kind: 'symbol', key: 'aapl' })).toBeNull();
        expect(rowToTopic({ kind: 'symbol', key: ' AAPL' })).toBeNull();
        expect(rowToTopic({ kind: 'symbol', key: '' })).toBeNull();
    });
});

describe('parseTopicInput', () => {
    it('심볼은 공백을 지우고 대문자로 맞춘다', () => {
        expect(parseTopicInput({ kind: 'symbol', symbol: ' aapl ' })).toEqual({
            kind: 'symbol',
            symbol: 'AAPL',
        });
    });

    it('잘못된 모양의 심볼은 null이다', () => {
        expect(parseTopicInput({ kind: 'symbol', symbol: '??' })).toBeNull();
        expect(parseTopicInput({ kind: 'symbol' })).toBeNull();
        expect(parseTopicInput({ kind: 'symbol', symbol: 3 })).toBeNull();
    });

    it('신호 유형은 신호별 페이지가 여는 유형만 받는다', () => {
        expect(
            parseTopicInput({
                kind: 'signal',
                signalType: 'macd_bullish_cross',
            })
        ).toEqual({ kind: 'signal', signalType: 'macd_bullish_cross' });
        expect(
            parseTopicInput({ kind: 'signal', signalType: 'cci_oversold' })
        ).toBeNull();
        expect(parseTopicInput({ kind: 'signal' })).toBeNull();
    });

    it('공포·탐욕 시장은 us, kr, crypto만 받는다', () => {
        expect(parseTopicInput({ kind: 'fear_greed', market: 'kr' })).toEqual({
            kind: 'fear_greed',
            market: 'kr',
        });
        expect(
            parseTopicInput({ kind: 'fear_greed', market: 'jp' })
        ).toBeNull();
        expect(parseTopicInput({ kind: 'fear_greed' })).toBeNull();
    });

    it('모르는 종류와 종류 없는 입력은 null이다', () => {
        expect(parseTopicInput({ kind: 'news', symbol: 'AAPL' })).toBeNull();
        expect(parseTopicInput({})).toBeNull();
    });

    it('FormData도 같은 규칙으로 읽는다', () => {
        const form = new FormData();
        form.set('kind', 'signal');
        form.set('signalType', 'death_cross');
        expect(parseTopicInput(form)).toEqual({
            kind: 'signal',
            signalType: 'death_cross',
        });
        const bad = new FormData();
        bad.set('kind', 'symbol');
        expect(parseTopicInput(bad)).toBeNull();
    });

    it('신호별 페이지가 여는 신호는 모두 받는다', () => {
        SIGNAL_HUBS.forEach(hub => {
            expect(
                parseTopicInput({ kind: 'signal', signalType: hub.signalType })
            ).toEqual({ kind: 'signal', signalType: hub.signalType });
        });
    });
});

describe('suppressionKey', () => {
    const signal: MailAlertItem = {
        kind: 'signal',
        section: 'mine',
        market: 'us',
        symbol: 'NVDA',
        name: null,
        signalType: 'golden_cross',
        sessionDate: '2026-11-24',
        changePercent: 1.2,
    };

    it('신호 키는 시장·종목·유형이고 날짜와 섹션은 넣지 않는다', () => {
        expect(suppressionKey(signal)).toBe('s:us:NVDA:golden_cross');
        expect(
            suppressionKey({
                ...signal,
                section: 'hub',
                sessionDate: '2026-11-26',
            })
        ).toBe('s:us:NVDA:golden_cross');
    });

    it('공포·탐욕 키는 시장과 구간이고 날짜와 점수는 넣지 않는다', () => {
        expect(
            suppressionKey({
                kind: 'fear_greed',
                market: 'kr',
                zone: 'EXTREME_FEAR',
                date: '2026-11-24',
                score: 12,
            })
        ).toBe('f:kr:EXTREME_FEAR');
    });
    describe('달라진 점 키', () => {
        const base = {
            kind: 'change' as const,
            section: 'mine' as const,
            market: 'us' as const,
            symbol: 'NVDA',
            name: null,
            sessionDate: '2026-11-24',
        };
        const analyzedAt = '2026-11-20T01:00:00.000Z';

        it('추세 키는 시장과 종목뿐이다(바뀐 방향과 날짜는 넣지 않는다)', () => {
            const up = suppressionKey({
                ...base,
                change: { kind: 'trend', from: 'neutral', to: 'bullish' },
            });
            const down = suppressionKey({
                ...base,
                sessionDate: '2026-11-26',
                change: { kind: 'trend', from: 'bullish', to: 'bearish' },
            });

            expect(up).toBe('t:us:NVDA');
            expect(down).toBe(up);
        });

        it('지지·저항선 키는 분석 시각, 선의 종류, 가격이다(종가와 방향은 넣지 않는다)', () => {
            const key = suppressionKey({
                ...base,
                change: {
                    kind: 'level',
                    side: 'support',
                    direction: 'down',
                    price: 180.5,
                    close: 178,
                    analyzedAt,
                },
            });

            expect(key).toBe(`l:us:NVDA:${analyzedAt}:support:180.5`);
        });

        it('진입 구간과 무효화 기준 키는 분석 시각과 위치다', () => {
            expect(
                suppressionKey({
                    ...base,
                    change: {
                        kind: 'plan_zone',
                        position: 'above_zone',
                        low: 1,
                        high: 2,
                        close: 3,
                        analyzedAt,
                    },
                })
            ).toBe(`pp:us:NVDA:${analyzedAt}:above_zone`);
            expect(
                suppressionKey({
                    ...base,
                    change: {
                        kind: 'plan_stopped',
                        stop: 1,
                        close: 0.5,
                        analyzedAt,
                    },
                })
            ).toBe(`pp:us:NVDA:${analyzedAt}:stopped`);
        });

        it('종류마다 키 접두사가 달라 서로 겹치지 않는다', () => {
            const keys = [
                suppressionKey({
                    ...base,
                    change: { kind: 'trend', from: 'neutral', to: 'bullish' },
                }),
                suppressionKey({
                    ...base,
                    change: {
                        kind: 'level',
                        side: 'resistance',
                        direction: 'up',
                        price: 1,
                        close: 2,
                        analyzedAt,
                    },
                }),
                suppressionKey({
                    ...base,
                    change: {
                        kind: 'plan_stopped',
                        stop: 1,
                        close: 0.5,
                        analyzedAt,
                    },
                }),
                'f:us:EXTREME_FEAR',
                's:us:NVDA:golden_cross',
            ];

            expect(new Set(keys.map(key => key.split(':')[0])).size).toBe(
                keys.length
            );
        });
    });
});
