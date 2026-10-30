import {
    AGENT_NARRATION_HOLD_CHARS,
    accumulateToolCallDeltas,
    buildToolCalls,
    holdNarration,
    mapStopReason,
    parseToolCallArgs,
    type PartialToolCall,
} from '@/entities/llm-provider/lib/agentStream';

describe('holdNarration', () => {
    it('보류가 풀린 스텝(null)은 delta를 그대로 내보낸다', () => {
        expect(holdNarration(null, 'abc')).toEqual({ held: null, emit: 'abc' });
    });

    it('한도 미만이면 내보내지 않고 누적한다', () => {
        expect(holdNarration('ab', 'cd')).toEqual({ held: 'abcd', emit: '' });
    });

    it('누적이 한도에 닿으면 전부 내보내고 보류를 푼다', () => {
        const held = 'a'.repeat(AGENT_NARRATION_HOLD_CHARS - 1);

        expect(holdNarration(held, 'b')).toEqual({
            held: null,
            emit: `${held}b`,
        });
    });
});

describe('mapStopReason', () => {
    it('tool_calls는 tool_use', () => {
        expect(mapStopReason('tool_calls', true)).toBe('tool_use');
    });

    it('stop은 도구 호출이 있으면 tool_use (Gemini 호환 엔드포인트)', () => {
        expect(mapStopReason('stop', true)).toBe('tool_use');
    });

    it('stop은 도구 호출이 없으면 end', () => {
        expect(mapStopReason('stop', false)).toBe('end');
    });

    it('length는 max_tokens', () => {
        expect(mapStopReason('length', false)).toBe('max_tokens');
    });

    it.each([null, undefined, 'content_filter'])('%s는 other', reason => {
        expect(mapStopReason(reason, false)).toBe('other');
    });
});

describe('parseToolCallArgs', () => {
    it('빈 문자열은 빈 객체', () => {
        expect(parseToolCallArgs('')).toEqual({});
    });

    it('JSON 객체를 읽는다', () => {
        expect(parseToolCallArgs('{"symbols":["AAPL"]}')).toEqual({
            symbols: ['AAPL'],
        });
    });

    it('깨진 JSON은 빈 객체', () => {
        expect(parseToolCallArgs('{"a":')).toEqual({});
    });

    it.each(['null', '3', '"s"'])('객체가 아닌 JSON(%s)은 빈 객체', raw => {
        expect(parseToolCallArgs(raw)).toEqual({});
    });
});

describe('accumulateToolCallDeltas', () => {
    it('인자 조각을 index별로 이어 붙이고 id·name은 한 번 받으면 유지한다', () => {
        const partial = new Map<number, PartialToolCall>();

        accumulateToolCallDeltas(partial, [
            { index: 0, id: 'c0', function: { name: 'get_quote' } },
        ]);
        accumulateToolCallDeltas(partial, [
            { index: 0, function: { arguments: '{"symb' } },
            { index: 1, id: 'c1', function: { name: 'x', arguments: '{}' } },
        ]);
        accumulateToolCallDeltas(partial, [
            { index: 0, function: { arguments: 'ols":[]}' } },
        ]);

        expect([...partial.entries()]).toEqual([
            [0, { id: 'c0', name: 'get_quote', args: '{"symbols":[]}' }],
            [1, { id: 'c1', name: 'x', args: '{}' }],
        ]);
    });
});

describe('buildToolCalls', () => {
    it('index 순으로 정렬하고 인자를 파싱한다', () => {
        const partial = new Map<number, PartialToolCall>([
            [1, { id: 'b', name: 'n2', args: '{"k":1}' }],
            [0, { id: 'a', name: 'n1', args: '' }],
        ]);

        expect(buildToolCalls(partial)).toEqual([
            { id: 'a', name: 'n1', args: {} },
            { id: 'b', name: 'n2', args: { k: 1 } },
        ]);
    });

    it('id가 없는 호출에는 call_<index>를 부여한다', () => {
        const partial = new Map<number, PartialToolCall>([
            [2, { id: '', name: 'n', args: '{}' }],
        ]);

        expect(buildToolCalls(partial)).toEqual([
            { id: 'call_2', name: 'n', args: {} },
        ]);
    });
});
