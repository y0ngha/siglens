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
});
