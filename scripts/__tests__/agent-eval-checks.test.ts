/**
 * Unit tests for scripts/agent-eval/checks.mjs — the pure judging functions of the SiglensAI regression eval.
 * No network, no DB, no clock: every transcript below is a hand-written fixture in the shape `run.mjs`
 * builds from the SSE frames and the stored rows.
 */
import { describe, expect, it, vi } from 'vitest';
import { CASES } from '../agent-eval/cases.mjs';
import {
    buildTranscript,
    CACHE_TOLERANCE_TOKENS,
    CHECKS,
    clockVariants,
    compareRuns,
    hasDateToken,
    isFigureSentence,
    isLocalUrl,
    mentionsWeekday,
    OFFER_RE,
    parseSseFrames,
    parseTurnNote,
    runChecks,
    splitSentences,
    storedOscillatorZones,
} from '../agent-eval/checks.mjs';

interface Transcript {
    question: string;
    answer: string;
    error: string | null;
    toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
    toolRows: { toolName: string; content: string }[];
    turnAt: string | null;
    turnContext: string | null;
    webSearchAvailable?: boolean;
    steps: { promptTokens: number; cachedTokens: number }[];
}

const transcript = (overrides: Partial<Transcript> = {}): Transcript => ({
    question: 'q',
    answer: '',
    error: null,
    toolCalls: [],
    toolRows: [],
    turnAt: null,
    turnContext: null,
    steps: [],
    ...overrides,
});

const NOTE = [
    '## Now',
    "- User's local time: 2026-11-20 23:09 KST (Friday; this week Mon 2026-11-16 to Sun 2026-11-22)",
    '- UTC: Fri 2026-11-20 14:09 · ET: Fri 2026-11-20 09:09 · KST: Fri 2026-11-20 23:09',
    '- US stocks (NYSE/Nasdaq): pre-market hours; opens Fri 2026-11-20 09:30 ET (in 21m)',
    '- Korean stocks (KRX): closed; opens Mon 2026-11-23 09:00 KST (in 2d 9h)',
].join('\n');

const barsRow = (latest: Record<string, unknown>) => ({
    toolName: 'get_bars_indicators',
    content: JSON.stringify({ latest }),
});

describe('parseTurnNote', () => {
    it('요일과 두 시장 줄의 상태·경계를 읽는다', () => {
        expect(parseTurnNote(NOTE)).toEqual({
            weekdayEnglish: 'Friday',
            us: {
                state: 'pre-market hours',
                verb: 'opens',
                weekday: 'Fri',
                date: '2026-11-20',
                hour: '09',
                minute: '30',
                zone: 'ET',
            },
            kr: {
                state: 'closed',
                verb: 'opens',
                weekday: 'Mon',
                date: '2026-11-23',
                hour: '09',
                minute: '00',
                zone: 'KST',
            },
        });
    });

    it('경계가 없는 줄은 상태만, KRX 줄이 없으면 kr은 null', () => {
        const note = [
            '## Now',
            "- User's local time: x (Saturday; this week y)",
            '- US stocks (NYSE/Nasdaq): closed',
        ].join('\n');
        expect(parseTurnNote(note)).toMatchObject({
            weekdayEnglish: 'Saturday',
            us: { state: 'closed', verb: null, hour: null },
            kr: null,
        });
    });

    it('메모가 없으면 null', () => {
        expect(parseTurnNote(null)).toBeNull();
    });
});

describe('문장·토큰 도우미', () => {
    it('소수점은 끊지 않고 문장과 줄바꿈에서 나눈다', () => {
        expect(splitSentences('RSI 44.74는 중립입니다. 다음 줄\n표')).toEqual([
            'RSI 44.74는 중립입니다.',
            '다음 줄',
            '표',
        ]);
    });

    it('수치 문장 판정', () => {
        expect(isFigureSentence('현재가는 231.42달러입니다.')).toBe(true);
        expect(isFigureSentence('종가는 3% 올랐습니다.')).toBe(true);
        expect(isFigureSentence('추세는 상승입니다.')).toBe(false);
        expect(isFigureSentence('| --- | --- |')).toBe(false);
    });

    it('날짜·시각 토큰', () => {
        expect(hasDateToken('9월 12일 종가 기준 231.42달러')).toBe(true);
        expect(hasDateToken('2026-09-12 종가 231.42')).toBe(true);
        expect(hasDateToken('as of the Sep 12 close')).toBe(true);
        expect(hasDateToken('현재가는 231.42달러입니다.')).toBe(false);
        expect(hasDateToken('Sep 12 close 기준 231.42')).toBe(true);
        expect(hasDateToken('as of November 20 the price')).toBe(true);
        expect(hasDateToken('2026-11-20 기준')).toBe(true);
        expect(hasDateToken('12일 기준 종가는 231.42')).toBe(true);
        expect(hasDateToken('장은 09:30에 열립니다')).toBe(true);
    });

    it('날짜가 아닌 말은 기준일로 세지 않는다(느슨한 정규식의 거짓 양성)', () => {
        expect(hasDateToken('RSI 기준으로 44.74입니다.')).toBe(false);
        expect(hasDateToken('3시간 전보다 1.2% 올랐습니다.')).toBe(false);
        expect(hasDateToken('The close was 231.42.')).toBe(false);
        expect(hasDateToken('기준일은 따로 없습니다.')).toBe(false);
        expect(hasDateToken('as of now it is 231.42')).toBe(false);
        expect(hasDateToken('the ratio is 119:30')).toBe(false);
    });

    it('제안 문구 정규식: 걸리는 말과 안 걸리는 말', () => {
        const offers = [
            '원하시면 시그렌즈 웹 검색으로 찾아볼게요.',
            '더 찾아볼까요?',
            '검색해 드릴까요?',
            "I can search if you'd like.",
            'If you would like, I can look.',
        ];
        offers.forEach(text => expect(OFFER_RE.test(text)).toBe(true));
        expect(OFFER_RE.test('웹 검색으로 확인했습니다.')).toBe(false);
    });

    it('시각 표기 변형은 0 패딩·시 분 표기를 모두 편다', () => {
        expect(clockVariants('09', '30')).toEqual([
            '09:30',
            '9:30',
            '9시 30분',
            '09시 30분',
        ]);
        expect(clockVariants('09', '00')).toContain('9시');
    });

    it('요일은 풀네임·(약어)·영문을 인정하고 문장 속 한 글자는 인정하지 않는다', () => {
        expect(mentionsWeekday('오늘은 금요일입니다', 'Friday')).toBe(true);
        expect(mentionsWeekday('11월 20일(금) 기준', 'Friday')).toBe(true);
        expect(mentionsWeekday('Today is Friday', 'Friday')).toBe(true);
        expect(mentionsWeekday('금액은 큽니다', 'Friday')).toBe(false);
        expect(mentionsWeekday('금요일', 'Funday')).toBe(false);
    });
});

describe('oscillatorsNamed', () => {
    const zones = {
        rsi: 'neutral',
        stochastic: 'oversold',
        williamsR: 'oversold',
        cci: 'oversold',
        mfi: 'neutral',
    };
    const run = (answer: string, latest: Record<string, unknown>) =>
        CHECKS.oscillatorsNamed(
            {},
            transcript({ answer, toolRows: [barsRow(latest)] })
        );

    it('통과: 중립이 아닌 오실레이터를 모두 이름으로 댄다', () => {
        const result = run(
            '스토캐스틱과 윌리엄스 %R, CCI가 과매도 구간입니다. RSI는 중립입니다.',
            { oscillatorZones: zones }
        );
        expect(result.fails).toEqual([]);
    });

    it('실패: 저장된 구간이 과매도인 지표를 답변이 빠뜨린다', () => {
        const result = run('RSI 44.74로 과매도가 아닙니다.', {
            oscillatorZones: zones,
        });
        expect(result.fails).toEqual([
            'osc: stochastic %K is oversold in the tool result but the answer never names it',
            'osc: Williams %R is oversold in the tool result but the answer never names it',
            'osc: CCI is oversold in the tool result but the answer never names it',
        ]);
    });

    it('review: 중립인 지표를 구간 이름으로 부른 문장', () => {
        const result = run(
            '스토캐스틱, 윌리엄스, CCI가 과매도입니다. MFI도 과매도입니다.',
            { oscillatorZones: zones }
        );
        expect(result.reviews).toEqual([
            'osc: neutral MFI may be called a zone: "MFI도 과매도입니다."',
        ]);
    });

    it('부정문은 review 대상이 아니다', () => {
        const result = run(
            '스토캐스틱, 윌리엄스, CCI가 과매도입니다. RSI는 과매도가 아닙니다.',
            { oscillatorZones: zones }
        );
        expect(result.reviews).toEqual([]);
    });

    it('옛 응답(구간 필드 없음)은 원값에서 같은 기준으로 구간을 만든다', () => {
        const latest = {
            rsi: 44.74,
            stochastic: { percentK: 15.96, percentD: 20 },
            williamsR: -80.08,
            cci: -103.51,
            mfi: 32.07,
        };
        expect(
            storedOscillatorZones(transcript({ toolRows: [barsRow(latest)] }))
        ).toEqual(zones);
        expect(run('RSI는 중립입니다.', latest).fails).toHaveLength(3);
    });

    it('경계값은 포함 비교다(RSI 30은 oversold, 70은 overbought)', () => {
        const at = (rsi: number) =>
            storedOscillatorZones(transcript({ toolRows: [barsRow({ rsi })] }))
                ?.rsi;
        expect(at(30)).toBe('oversold');
        expect(at(70)).toBe('overbought');
        expect(at(30.01)).toBe('neutral');
    });

    it('도구 결과가 없거나 절단돼 읽을 수 없으면 실패', () => {
        const result = CHECKS.oscillatorsNamed(
            {},
            transcript({
                answer: 'x',
                toolRows: [
                    { toolName: 'get_bars_indicators', content: '{"trunc' },
                ],
            })
        );
        expect(result.fails).toHaveLength(1);
    });
});

describe('firstFigureHasDate', () => {
    const run = (answer: string) =>
        CHECKS.firstFigureHasDate({}, transcript({ answer }));

    it('통과: 수치가 처음 나오는 문장에 날짜가 있다', () => {
        expect(
            run('추세는 상승입니다. 9월 12일 종가 기준 231.42달러입니다.').fails
        ).toEqual([]);
    });

    it('실패: 첫 수치 문장에 날짜가 없다(뒤 문장의 날짜는 세지 않는다)', () => {
        const result = run(
            '현재가는 231.42달러입니다. 9월 12일 종가 기준입니다.'
        );
        expect(result.fails).toEqual([
            'asof: the first figure sentence has no date or time token: "현재가는 231.42달러입니다."',
        ]);
    });

    it('수치 문장이 없으면 실패가 아니라 review', () => {
        const result = run('추세는 상승입니다.');
        expect(result.fails).toEqual([]);
        expect(result.reviews).toHaveLength(1);
    });
});

describe('dividendVerbatim', () => {
    const fundamentals = (latestAmount: number) => ({
        toolName: 'get_fundamentals',
        content: JSON.stringify({ dividends: { latestAmount } }),
    });
    const run = (answer: string, amount: number) =>
        CHECKS.dividendVerbatim(
            {},
            transcript({ answer, toolRows: [fundamentals(amount)] })
        );

    it('통과: 모든 자릿수가 그대로 있다', () => {
        expect(run('주당 0.648375달러입니다.', 0.648375).fails).toEqual([]);
    });

    it('실패: 센트로 반올림했다', () => {
        expect(run('주당 0.65달러입니다.', 0.648375).fails).toEqual([
            'div: latestAmount 0.648375 does not appear verbatim in the answer',
        ]);
    });

    it('소수 셋째 자리 미만 값은 반올림을 시험하지 못한다고 review', () => {
        const result = run('주당 1.01달러입니다.', 1.01);
        expect(result.fails).toEqual([]);
        expect(result.reviews[0]).toContain('has 2 decimals');
    });

    it('값이 저장돼 있지 않으면 review', () => {
        const result = CHECKS.dividendVerbatim({}, transcript({ answer: 'x' }));
        expect(result.fails).toEqual([]);
        expect(result.reviews).toHaveLength(1);
    });
});

describe('noOffer · webSearchWhenMissing', () => {
    it('noOffer: 제안 문구가 있으면 실패, 없으면 통과', () => {
        expect(
            CHECKS.noOffer(
                {},
                transcript({ answer: '확인했습니다. 원하시면 더 찾아볼게요.' })
            ).fails
        ).toHaveLength(1);
        expect(
            CHECKS.noOffer({}, transcript({ answer: '확인했습니다.' })).fails
        ).toEqual([]);
    });

    describe('webSearchWhenMissing', () => {
        const testCase = { holder: 'Two Sigma' };
        const flows = (content: string) => ({
            toolName: 'get_investor_flows',
            content,
        });
        const call = { id: 'c1', name: 'web_search', args: {} };
        const run = (overrides: Partial<Transcript>) =>
            CHECKS.webSearchWhenMissing(testCase, transcript(overrides));

        it('web_search를 불렀으면 통과', () => {
            expect(
                run({ toolCalls: [call], toolRows: [flows('{}')] }).fails
            ).toEqual([]);
        });

        it('첫 결과에 보유자가 이미 있으면 검색하지 않아도 통과(대소문자 무시)', () => {
            expect(
                run({
                    toolRows: [
                        flows('{"holders":[{"name":"TWO SIGMA ADVISERS"}]}'),
                    ],
                }).fails
            ).toEqual([]);
        });

        it('보유자가 없고 web_search를 쓸 수 있었는데 부르지 않았으면 실패', () => {
            const result = run({ toolRows: [flows('{"holders":[]}')] });
            expect(result.fails).toEqual([
                'search: the first result lacks "Two Sigma" and web_search was available but not called',
            ]);
        });

        it('결과 행이 아예 없어도 보유자는 없는 것으로 보고 실패', () => {
            expect(run({}).fails).toHaveLength(1);
        });

        it('web_search를 쓸 수 없는 실행이면 실패가 아니라 review', () => {
            const flag = run({
                toolRows: [flows('{}')],
                webSearchAvailable: false,
            });
            expect(flag.fails).toEqual([]);
            expect(flag.reviews).toHaveLength(1);
            const unavailable = run({
                toolRows: [
                    flows('{}'),
                    {
                        toolName: 'web_search',
                        content: '{"error":"unavailable"}',
                    },
                ],
            });
            expect(unavailable.fails).toEqual([]);
            expect(unavailable.reviews).toHaveLength(1);
        });
    });
});

describe('clockBoundary', () => {
    const run = (answer: string, turnContext: string | null = NOTE) =>
        CHECKS.clockBoundary({}, transcript({ answer, turnContext }));

    it('통과: US 줄의 경계 시각 09:30을 말한다(표기 변형 허용)', () => {
        expect(run('지금은 장 시작 전이고 09:30 ET에 열립니다.').fails).toEqual(
            []
        );
        expect(run('미국장은 9시 30분(ET)에 개장합니다.').fails).toEqual([]);
    });

    it('실패: 경계 시각이 없다', () => {
        expect(run('곧 열립니다.').fails).toEqual([
            'clock: the answer does not state the US boundary 09:30 ET',
        ]);
    });

    it('메모를 읽을 수 없으면 실패', () => {
        expect(run('x', null).fails).toHaveLength(1);
    });

    it('"9:30"은 "19:30" 속에서 잡히지 않는다(토큰 경계)', () => {
        expect(run('개장은 19:30입니다.').fails).toHaveLength(1);
        expect(run('개장은 119시 30분입니다.').fails).toHaveLength(1);
        expect(run('개장은 (09:30)입니다.').fails).toEqual([]);
    });
});

describe('weekdayAndKrxBoundary', () => {
    const run = (answer: string) =>
        CHECKS.weekdayAndKrxBoundary(
            {},
            transcript({ answer, turnContext: NOTE })
        );

    it('통과: 요일과 KRX 개장 시각을 모두 말한다', () => {
        expect(
            run('오늘은 금요일이고 한국장은 월요일 09:00에 열립니다.').fails
        ).toEqual([]);
    });

    it('실패: 요일이 빠졌다', () => {
        expect(run('한국장은 09:00에 열립니다.').fails).toEqual([
            'clock: the answer does not say the weekday (Friday)',
        ]);
    });

    it('KRX 줄이 없거나 깨진 메모는 그 자체가 실패다', () => {
        const withoutKr = NOTE.split('\n')
            .filter(line => !line.includes('Korean stocks'))
            .join('\n');
        const malformedKr = NOTE.replace(
            '- Korean stocks (KRX): closed; opens',
            '- Korean stocks (KRX) closed opens'
        );
        [withoutKr, malformedKr].forEach(note =>
            expect(
                CHECKS.weekdayAndKrxBoundary(
                    {},
                    transcript({
                        answer: '오늘은 금요일이고 09:00에 엽니다.',
                        turnContext: note,
                    })
                ).fails
            ).toEqual([
                'clock: the note has no readable Korean stocks (KRX) line',
            ])
        );
    });

    it('요일을 못 읽은 메모도 실패다', () => {
        const result = CHECKS.weekdayAndKrxBoundary(
            {},
            transcript({
                answer: '09:00',
                turnContext: NOTE.replace(
                    '(Friday; this week',
                    '(??; this week'
                ),
            })
        );
        expect(result.fails).toEqual([
            'clock: the note has no readable weekday on its local-time line',
        ]);
    });

    it('KRX 시각은 토큰 경계로 센다("19:00"은 "09:00"이 아니다)', () => {
        expect(run('오늘은 금요일이고 19:00에 엽니다.').fails).toEqual([
            'clock: the answer does not state the KRX boundary 09:00 KST',
        ]);
    });

    it('실패: KRX 시각이 빠졌다', () => {
        expect(run('오늘은 금요일입니다.').fails).toEqual([
            'clock: the answer does not state the KRX boundary 09:00 KST',
        ]);
    });
});

describe('cachedPrefix', () => {
    const step = (promptTokens: number, cachedTokens: number) => ({
        promptTokens,
        cachedTokens,
    });
    const previous = transcript({ steps: [step(500, 0), step(300, 9_000)] });
    // 직전 턴 마지막 단계의 전체 입력 = 300 + 9000 = 9300, 허용 192 → 문턱 9108.
    const threshold = 300 + 9_000 - CACHE_TOLERANCE_TOKENS;
    const run = (firstCached: number, prev: Transcript | null = previous) =>
        CHECKS.cachedPrefix(
            {},
            transcript({ steps: [step(100, firstCached)] }),
            prev
        );

    it('경계: 문턱과 같으면 통과, 1 모자라면 실패', () => {
        expect(threshold).toBe(9_108);
        expect(run(threshold).fails).toEqual([]);
        expect(run(threshold - 1).fails).toHaveLength(1);
    });

    it('첫 턴(직전 없음)은 검사하지 않는다', () => {
        expect(run(0, null).fails).toEqual([]);
    });

    it('usage 프레임이 없으면 실패', () => {
        expect(
            CHECKS.cachedPrefix({}, transcript(), previous).fails
        ).toHaveLength(1);
    });
});

describe('runChecks', () => {
    it('mustCall 누락·mustNotCall 호출·스트림 오류를 합쳐 보고한다', () => {
        const result = runChecks(
            {
                mustCall: ['get_quote', 'get_news'],
                mustNotCall: ['web_search'],
                checks: [],
            },
            transcript({
                error: 'deadline',
                toolCalls: [
                    { id: '1', name: 'get_quote', args: {} },
                    { id: '2', name: 'web_search', args: {} },
                ],
            })
        );
        expect(result.fails).toEqual([
            'turn: the stream ended with error deadline',
            'tool: get_news was not called',
            'tool: web_search must not be called',
        ]);
    });

    it('이름으로 단 검사를 돌리고 모르는 이름은 실패로 알린다', () => {
        const result = runChecks(
            { checks: ['noOffer', 'nope'] },
            transcript({ answer: '원하시면 알려드릴게요.' })
        );
        expect(result.fails).toEqual([
            'offer: the answer offers a lookup: "원하시면 알려드릴게요."',
            'unknown check nope',
        ]);
    });

    it('모든 케이스가 등록된 검사 이름만 쓴다', () => {
        interface EvalCase {
            checks?: string[];
            turns?: EvalCase[];
        }
        const flatten = (c: EvalCase): string[] => [
            ...(c.checks ?? []),
            ...(c.turns ?? []).flatMap(flatten),
        ];
        const names = (CASES as EvalCase[]).flatMap(flatten);
        expect(names.length).toBeGreaterThan(0);
        expect(names.every(name => name in CHECKS)).toBe(true);
    });
});

describe('실행기 보조 함수', () => {
    it('isLocalUrl: 로컬만 통과한다', () => {
        expect(isLocalUrl('http://localhost:4200')).toBe(true);
        expect(isLocalUrl('http://127.0.0.1:5433/db')).toBe(true);
        expect(isLocalUrl('http://ai.localhost:4200')).toBe(true);
        expect(isLocalUrl('postgres://u:p@localhost:5433/siglens')).toBe(true);
        expect(isLocalUrl('https://ai.siglens.io')).toBe(false);
        expect(isLocalUrl('postgres://u:p@db.example.com:5432/x')).toBe(false);
        expect(isLocalUrl('http://localhost.evil.com')).toBe(false);
        expect(isLocalUrl('not a url')).toBe(false);
    });

    it('parseSseFrames: heartbeat를 버리고 JSON data를 파싱한다', () => {
        const text = [
            'event: meta\ndata: {"conversationId":"c1"}',
            'event: heartbeat\ndata: {}',
            'event: text\ndata: {"delta":"안녕"}',
        ].join('\n\n');
        expect(parseSseFrames(text)).toEqual([
            { event: 'meta', data: { conversationId: 'c1' } },
            { event: 'text', data: { delta: '안녕' } },
        ]);
    });

    it('buildTranscript: 단계 usage만 steps에 담고 합계 프레임·이전 턴 행은 뺀다', () => {
        const frames = [
            {
                event: 'meta',
                data: {
                    conversationId: 'c1',
                    userMessageId: 'u2',
                    userMessageSeq: 5,
                },
            },
            {
                event: 'tool_start',
                data: {
                    id: 't1',
                    name: 'get_quote',
                    args: { symbols: ['AAPL'] },
                },
            },
            {
                event: 'usage',
                data: { usage: { promptTokens: 100, cachedTokens: 40 } },
            },
            {
                event: 'usage',
                data: { usage: { promptTokens: 50, cachedTokens: 140 } },
            },
            {
                event: 'usage',
                data: {
                    usage: {
                        promptTokens: 150,
                        cachedTokens: 180,
                        steps: 2,
                        ms: 900,
                    },
                },
            },
            { event: 'done', data: { body: '답변 본문' } },
        ];
        const rows = [
            {
                id: 'u1',
                seq: 1,
                role: 'user',
                content: 'q1',
                toolName: null,
                turnAt: new Date('2026-11-20T01:00:00.000Z'),
            },
            {
                id: 't0',
                seq: 3,
                role: 'tool',
                content: '{"old":1}',
                toolName: 'get_news',
                turnAt: null,
            },
            {
                id: 'u2',
                seq: 5,
                role: 'user',
                content: 'q2',
                toolName: null,
                turnAt: new Date('2026-11-20T14:09:00.000Z'),
            },
            {
                id: 't2',
                seq: 7,
                role: 'tool',
                content: '{"price":1}',
                toolName: 'get_quote',
                turnAt: null,
            },
        ];
        const noteFor = vi.fn((turnAt: string) => `${NOTE}\n(${turnAt})`);
        expect(
            buildTranscript({ question: 'q2', frames, rows, noteFor })
        ).toEqual({
            question: 'q2',
            conversationId: 'c1',
            answer: '답변 본문',
            error: null,
            toolCalls: [
                { id: 't1', name: 'get_quote', args: { symbols: ['AAPL'] } },
            ],
            toolRows: [{ toolName: 'get_quote', content: '{"price":1}' }],
            turnAt: '2026-11-20T14:09:00.000Z',
            turnContext: `${NOTE}\n(2026-11-20T14:09:00.000Z)`,
            webSearchAvailable: true,
            steps: [
                { promptTokens: 100, cachedTokens: 40 },
                { promptTokens: 50, cachedTokens: 140 },
            ],
        });
    });

    it('buildTranscript: error 프레임의 code를 담고 done이 없으면 text 조각을 이어 붙인다', () => {
        const frames = [
            { event: 'text', data: { delta: '절' } },
            { event: 'text', data: { delta: '반' } },
            { event: 'error', data: { code: 'deadline' } },
        ];
        expect(
            buildTranscript({ question: 'q', frames, rows: [] })
        ).toMatchObject({
            answer: '절반',
            error: 'deadline',
        });
    });

    it('compareRuns: NEW가 OLD가 부른 도구를 빠뜨리면 droppedTools에 나온다', () => {
        const run = (fails: string[], tools: string[]) => ({
            label: 'x',
            results: [
                {
                    id: 'osc-1',
                    fails,
                    turns: [
                        {
                            toolCalls: tools.map((name, i) => ({
                                id: String(i),
                                name,
                                args: {},
                            })),
                        },
                    ],
                },
            ],
        });
        expect(
            compareRuns(
                run(['a', 'b'], ['get_bars_indicators', 'get_news']),
                run(['a'], ['get_bars_indicators', 'web_search'])
            )
        ).toEqual([
            {
                id: 'osc-1',
                oldFails: 2,
                newFails: 1,
                droppedTools: ['get_news'],
                addedTools: ['web_search'],
            },
        ]);
    });
});
