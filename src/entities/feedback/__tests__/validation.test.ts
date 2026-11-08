import { SYMBOL_MAX_LENGTH } from '@/shared/db/constants';
import { TRANSCRIPT_MAX_ENTRIES, TRANSCRIPT_MAX_TOOLS } from '../lib/constants';
import {
    parseAiFeedbackInput,
    parseUpdateInput,
    parseVocInput,
    sanitizePagePath,
} from '../lib/validation';

const UUID = '3f2b8c1e-9d4a-4e6b-8a1c-0123456789ab';

describe('sanitizePagePath', () => {
    it('쿼리와 해시를 제거한다', () => {
        expect(sanitizePagePath('/AAPL?token=secret#top')).toBe('/AAPL');
    });

    it('512자로 자른다', () => {
        const path = sanitizePagePath(`/${'a'.repeat(600)}`);
        expect(path).toHaveLength(512);
    });

    it.each(['https://evil.example/x', '//evil.example', 'AAPL', 1, null])(
        '경로가 아닌 값 %s 는 거부한다',
        value => {
            expect(sanitizePagePath(value)).toBeNull();
        }
    );
});

describe('parseVocInput', () => {
    const valid = {
        surface: 'siglens',
        rating: 4,
        comment: '  좋아요  ',
        trigger: 'analysis',
        pagePath: '/AAPL?x=1',
    };

    it('유효한 입력을 정리해 돌려준다', () => {
        expect(parseVocInput(valid)).toEqual({
            surface: 'siglens',
            rating: 4,
            comment: '좋아요',
            trigger: 'analysis',
            pagePath: '/AAPL',
        });
    });

    it('빈 의견은 comment 키를 생략한다', () => {
        expect(parseVocInput({ ...valid, comment: '   ' })).not.toHaveProperty(
            'comment'
        );
    });

    it.each([0, 6, 3.5, '4', null])('별점 %s 는 거부한다', rating => {
        expect(parseVocInput({ ...valid, rating })).toBeNull();
    });

    it('별점 경계 1과 5는 허용한다', () => {
        expect(parseVocInput({ ...valid, rating: 1 })).not.toBeNull();
        expect(parseVocInput({ ...valid, rating: 5 })).not.toBeNull();
    });

    it('의견 1000자는 허용하고 1001자는 거부한다', () => {
        expect(
            parseVocInput({ ...valid, comment: 'a'.repeat(1000) })
        ).not.toBeNull();
        expect(
            parseVocInput({ ...valid, comment: 'a'.repeat(1001) })
        ).toBeNull();
    });

    it('알 수 없는 surface·trigger 는 거부한다', () => {
        expect(parseVocInput({ ...valid, surface: 'x' })).toBeNull();
        expect(parseVocInput({ ...valid, trigger: 'x' })).toBeNull();
    });

    it('객체가 아니면 거부한다', () => {
        expect(parseVocInput(null)).toBeNull();
        expect(parseVocInput('x')).toBeNull();
    });

    it('여분의 키는 결과에 남기지 않는다', () => {
        expect(parseVocInput({ ...valid, userId: 'u' })).not.toHaveProperty(
            'userId'
        );
    });
});

describe('parseAiFeedbackInput', () => {
    const siglens = {
        surface: 'siglens',
        vote: 'down',
        context: {
            analysisType: 'technical',
            symbol: 'AAPL',
            reasoning: true,
            extra: { scope: 'us', evil: 'x' },
            viewMode: 'plain',
            injected: 'x',
        },
        snapshot: { summary: 's' },
        pagePath: '/AAPL?a=1',
    };
    const agent = {
        surface: 'siglens_ai',
        vote: 'up',
        context: { messageIndex: 1, guest: false, conversationId: UUID },
        snapshot: [
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'a', tools: [{ name: 't' }] },
        ],
        pagePath: '/c/abc',
    };

    it('siglens 입력은 알려진 컨텍스트 키만 남긴다', () => {
        const parsed = parseAiFeedbackInput(siglens);
        expect(parsed).toEqual({
            surface: 'siglens',
            vote: 'down',
            context: {
                analysisType: 'technical',
                symbol: 'AAPL',
                reasoning: true,
                extra: { scope: 'us' },
                viewMode: 'plain',
            },
            snapshot: { summary: 's' },
            pagePath: '/AAPL',
        });
    });

    it('알 수 없는 analysisType 은 거부한다', () => {
        expect(
            parseAiFeedbackInput({
                ...siglens,
                context: { analysisType: 'bogus' },
            })
        ).toBeNull();
    });

    it('siglens snapshot 이 없으면 거부한다', () => {
        const { snapshot: _snapshot, ...rest } = siglens;
        expect(parseAiFeedbackInput(rest)).toBeNull();
    });

    it('64자를 넘는 컨텍스트 문자열(모델 id 등)은 거부한다', () => {
        expect(
            parseAiFeedbackInput({
                ...siglens,
                context: { analysisType: 'news', modelId: 'a'.repeat(65) },
            })
        ).toBeNull();
    });

    it('vote 가 up/down 이 아니면 거부한다', () => {
        expect(parseAiFeedbackInput({ ...siglens, vote: 'meh' })).toBeNull();
    });

    it('siglens_ai 입력을 대화 기록 모양으로 통과시킨다', () => {
        expect(parseAiFeedbackInput(agent)).toEqual({
            ...agent,
            pagePath: '/c/abc',
        });
    });

    it('대화 기록의 role 이 잘못되면 거부한다', () => {
        expect(
            parseAiFeedbackInput({
                ...agent,
                snapshot: [{ role: 'tool', content: 'x' }],
            })
        ).toBeNull();
    });

    it('대화 기록이 상한을 넘으면 거부하지 않고 가장 최근 줄만 남긴다', () => {
        const long = Array.from(
            { length: TRANSCRIPT_MAX_ENTRIES + 5 },
            (_, i) => ({ role: 'user', content: `m${i}` })
        );
        const parsed = parseAiFeedbackInput({ ...agent, snapshot: long });
        const snapshot = (parsed as { snapshot: { content: string }[] })
            .snapshot;
        expect(snapshot).toHaveLength(TRANSCRIPT_MAX_ENTRIES);
        expect(snapshot[0]?.content).toBe('m5');
        expect(snapshot.at(-1)?.content).toBe(`m${TRANSCRIPT_MAX_ENTRIES + 4}`);
    });

    it('한 턴의 도구는 core 턴 상한(30)까지 모두 받고 넘치면 자른다', () => {
        const toolsOf = (n: number) =>
            Array.from({ length: n }, (_, i) => ({ name: `t${i}` }));
        const run = (n: number) =>
            (
                parseAiFeedbackInput({
                    ...agent,
                    snapshot: [
                        { role: 'assistant', content: 'a', tools: toolsOf(n) },
                    ],
                }) as { snapshot: { tools: unknown[] }[] }
            ).snapshot[0]?.tools;
        expect(TRANSCRIPT_MAX_TOOLS).toBe(30);
        expect(run(30)).toHaveLength(30);
        expect(run(45)).toHaveLength(30);
    });

    it('messageIndex 는 크기와 무관하게 음이 아닌 정수면 받는다', () => {
        const withIndex = (messageIndex: number) =>
            parseAiFeedbackInput({
                ...agent,
                context: { messageIndex, guest: false },
            });
        expect(withIndex(5000)).not.toBeNull();
        expect(withIndex(-1)).toBeNull();
        expect(withIndex(1.5)).toBeNull();
    });

    it('심볼은 feedback.symbol 컬럼 길이를 넘으면 거부한다', () => {
        const withSymbol = (symbol: string) =>
            parseAiFeedbackInput({
                ...siglens,
                context: { analysisType: 'news', symbol },
            });
        expect(withSymbol('A'.repeat(SYMBOL_MAX_LENGTH))).not.toBeNull();
        expect(withSymbol('A'.repeat(SYMBOL_MAX_LENGTH + 1))).toBeNull();
    });

    it('uuid 가 아닌 conversationId 는 거부한다', () => {
        expect(
            parseAiFeedbackInput({
                ...agent,
                context: { messageIndex: 0, guest: false, conversationId: 'x' },
            })
        ).toBeNull();
    });

    it('guest 가 boolean 이 아니면 거부한다', () => {
        expect(
            parseAiFeedbackInput({
                ...agent,
                context: { messageIndex: 0, guest: 'no' },
            })
        ).toBeNull();
    });

    it('알 수 없는 surface 는 거부한다', () => {
        expect(parseAiFeedbackInput({ ...agent, surface: 'x' })).toBeNull();
    });

    it('pagePath 가 경로가 아니면 거부한다', () => {
        expect(
            parseAiFeedbackInput({ ...agent, pagePath: 'http://x' })
        ).toBeNull();
    });
});

describe('parseUpdateInput', () => {
    it('방향·사유·의견을 정리한다(사유는 중복 제거)', () => {
        expect(
            parseUpdateInput({
                id: UUID,
                vote: 'down',
                reasons: ['inaccurate', 'inaccurate', 'other'],
                comment: ' 틀렸어요 ',
            })
        ).toEqual({
            id: UUID,
            vote: 'down',
            reasons: ['inaccurate', 'other'],
            comment: '틀렸어요',
        });
    });

    it('빈 의견은 지우기 신호로 빈 문자열을 유지한다', () => {
        expect(parseUpdateInput({ id: UUID, comment: '  ' })).toEqual({
            id: UUID,
            comment: '',
        });
    });

    it('id 가 uuid 가 아니면 거부한다', () => {
        expect(parseUpdateInput({ id: 'x', vote: 'up' })).toBeNull();
    });

    it('바꿀 필드가 하나도 없으면 거부한다', () => {
        expect(parseUpdateInput({ id: UUID })).toBeNull();
    });

    it('알 수 없는 사유 코드는 거부한다', () => {
        expect(parseUpdateInput({ id: UUID, reasons: ['nope'] })).toBeNull();
    });

    it('의견 500자는 허용하고 501자는 거부한다', () => {
        expect(
            parseUpdateInput({ id: UUID, comment: 'a'.repeat(500) })
        ).not.toBeNull();
        expect(
            parseUpdateInput({ id: UUID, comment: 'a'.repeat(501) })
        ).toBeNull();
    });
});
