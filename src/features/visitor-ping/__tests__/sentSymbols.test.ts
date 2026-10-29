import { describe, expect, it } from 'vitest';
import {
    SYMBOL_VIEWS_STORAGE_KEY,
    parseSentSymbols,
    serializeSentSymbols,
} from '@/features/visitor-ping/lib/sentSymbols';

describe('SYMBOL_VIEWS_STORAGE_KEY', () => {
    it('이미 저장된 기록을 읽도록 키가 고정돼 있다', () => {
        // 키가 바뀌면 오늘 이미 보낸 종목을 다시 보내게 된다.
        expect(SYMBOL_VIEWS_STORAGE_KEY).toBe('siglens:symbol-views');
    });
});

describe('parseSentSymbols', () => {
    it('같은 날 기록이면 심볼 목록을 돌려준다', () => {
        const raw = JSON.stringify({ date: '2026-10-29', symbols: ['AAPL'] });
        expect(parseSentSymbols(raw, '2026-10-29')).toEqual(['AAPL']);
    });

    it.each([
        ['값 없음', null],
        ['다른 날짜', '{"date":"2026-10-28","symbols":["AAPL"]}'],
        ['깨진 JSON', '{not json'],
        ['형태가 다름', '{"date":"2026-10-29","symbols":"AAPL"}'],
        ['null 값', 'null'],
    ])('%s이면 빈 배열이다', (_label, raw) => {
        expect(parseSentSymbols(raw, '2026-10-29')).toEqual([]);
    });
});

describe('serializeSentSymbols', () => {
    it('기존 목록 뒤에 심볼을 덧붙여 직렬화한다', () => {
        expect(serializeSentSymbols('2026-10-29', ['AAPL'], 'NVDA')).toBe(
            '{"date":"2026-10-29","symbols":["AAPL","NVDA"]}'
        );
    });

    it('직렬화한 값을 다시 읽으면 같은 목록이다', () => {
        const raw = serializeSentSymbols('2026-10-29', [], 'AAPL');
        expect(parseSentSymbols(raw, '2026-10-29')).toEqual(['AAPL']);
    });
});
