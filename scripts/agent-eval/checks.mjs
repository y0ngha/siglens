// SiglensAI 에이전트 회귀 평가의 순수 판정 함수 (네트워크·DB·시계 없음 — 단위 테스트 대상).
//
// 판정은 `(case, transcript, previous?) → { fails, reviews }`다. `fails`는 하드 실패, `reviews`는 사람이
// 읽고 판단할 줄이다. 값은 저장된 도구 행과 그 턴의 `turn_context` 메모에서 읽으므로 시장 날짜에 의존하지 않는다.
//
// transcript 모양 (run.mjs가 `buildTranscript`로 만든다)
//   {
//     question, answer,                       // 질문과 화면에 나간 답변 본문
//     error,                                  // SSE `error` 프레임의 code 또는 null
//     toolCalls: [{ id, name, args }],        // SSE `tool_start`
//     toolRows:  [{ toolName, content }],     // DB tool 행(이 턴 것만), content는 도구 결과 JSON 문자열
//     turnAt, turnContext,                    // 이 턴 user 행의 `turn_at`(ISO)과, 그 시각으로 core가 다시 만든 "## Now" 메모(없으면 null)
//     webSearchAvailable,                     // false면 이 실행에서 web_search를 쓸 수 없었다(run.mjs --no-web-search)
//     steps: [{ promptTokens, cachedTokens }] // provider 호출 단계별 usage 프레임
//   }

/** 도구 호출 이름의 집합. */
const calledNames = transcript =>
    new Set(transcript.toolCalls.map(call => call.name));

/** 그 도구의 결과 행(JSON 문자열)을 파싱한다. 절단됐거나 JSON이 아니면 null. */
export function parseToolResult(transcript, toolName) {
    const row = transcript.toolRows.find(r => r.toolName === toolName);
    if (row === undefined) return null;
    try {
        const parsed = JSON.parse(row.content);
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------- 문장·정규식

/** 마침표·물음표·줄바꿈 기준으로 문장을 나눈다. 숫자 속 소수점(`44.74`)은 끊지 않는다. */
export function splitSentences(text) {
    return text
        .split(/(?<=[.!?。])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/** 가격·등락률·지표값처럼 "수치"가 들어 있는 문장인지. 표 구분선·머리글은 제외한다. */
const FIGURE_RE = /\d[\d,]*\.\d+|\d+\s*(?:%|퍼센트|달러|원|포인트)|\$\s?\d/;
export const isFigureSentence = sentence =>
    !/^[#|>\-*\s]*$/.test(sentence) && FIGURE_RE.test(sentence);

/**
 * 기준일 토큰. 날짜 자체(`2026-11-20`, `11월 20일`, `Nov 20`/`November 20`), 시각 `HH:MM`, 또는 날짜·종가와 붙은
 * 명시적 기준 문구(`종가 기준`, `12일 기준`, `as of Sep 12`, `as of the Sep 12 close`)만 센다. "RSI 기준으로"의
 * `기준으로`, `3시간`, 맨 `close`처럼 날짜를 가리키지 않는 말은 세지 않는다.
 */
const MONTH_NAME =
    '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_TOKEN_RE = new RegExp(
    [
        String.raw`\d{4}[-./]\d{1,2}[-./]\d{1,2}`,
        String.raw`\d{1,2}월\s*\d{1,2}일`,
        String.raw`\b${MONTH_NAME}\.?\s+\d{1,2}\b`,
        String.raw`(?<![\d:])\d{1,2}:\d{2}(?!\d)`,
        String.raw`종가\s*기준`,
        String.raw`\d{1,2}일\s*기준`,
        String.raw`\bas of\s+(?:the\s+)?(?:${MONTH_NAME}\.?\s+\d{1,2}\b|\d{4}-\d{2}-\d{2}|[A-Za-z0-9 ]{0,30}?\bclose\b)`,
    ].join('|'),
    'i'
);
export const hasDateToken = sentence => DATE_TOKEN_RE.test(sentence);

/** 조회를 "해 드릴까요"로 미루는 문구. 도구가 있으면 호출해야지 제안하면 안 된다. */
export const OFFER_RE =
    /원하시면|찾아볼까요|찾아봐 드릴까요|검색해\s*드릴까요|검색해\s*볼까요|if you'?d like|if you would like|if you want me to/i;

// -------------------------------------------------------------------- 메모 파싱

/** `## Now` 메모에서 장 상태 줄(`US`/`Korean`)과 요일을 읽는다. 메모가 없거나 모양이 다르면 null. */
export function parseTurnNote(note) {
    if (typeof note !== 'string') return null;
    const marketLine = label => {
        const match = note.match(
            new RegExp(
                `^- ${label}[^:\\n]*: ([^;\\n]+?)(?:; (opens|closes) (\\w{3}) (\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2}) (ET|KST))?(?: \\(.*\\))?$`,
                'm'
            )
        );
        if (match === null) return null;
        const [, state, verb, weekday, date, hour, minute, zone] = match;
        return {
            state,
            verb: verb ?? null,
            weekday: weekday ?? null,
            date: date ?? null,
            hour: hour ?? null,
            minute: minute ?? null,
            zone: zone ?? null,
        };
    };
    const local = note.match(/^- User's local time: .*\((\w+); this week /m);
    return {
        weekdayEnglish: local?.[1] ?? null,
        us: marketLine('US stocks'),
        kr: marketLine('Korean stocks'),
    };
}

const WEEKDAY_KO = {
    Monday: ['월요일', '월'],
    Tuesday: ['화요일', '화'],
    Wednesday: ['수요일', '수'],
    Thursday: ['목요일', '목'],
    Friday: ['금요일', '금'],
    Saturday: ['토요일', '토'],
    Sunday: ['일요일', '일'],
};

/** 답변에 그 요일이 한국어(`금요일`) 또는 영어(`Friday`)로 들어 있는지. 한 글자 약어는 "(금)" 꼴만 인정한다. */
export function mentionsWeekday(answer, weekdayEnglish) {
    const names = WEEKDAY_KO[weekdayEnglish];
    if (names === undefined) return false;
    const [full, short] = names;
    return (
        answer.includes(full) ||
        answer.includes(`(${short})`) ||
        new RegExp(weekdayEnglish, 'i').test(answer)
    );
}

/** `09:30`을 답변이 쓸 수 있는 꼴들(`09:30`, `9:30`, `9시 30분`, 정각이면 `9시`)로 편다. */
export function clockVariants(hour, minute) {
    const h = String(Number(hour));
    return [
        `${hour}:${minute}`,
        `${h}:${minute}`,
        Number(minute) === 0 ? `${h}시` : `${h}시 ${Number(minute)}분`,
        Number(minute) === 0 ? `${hour}시` : `${hour}시 ${minute}분`,
    ];
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 시각 표기가 숫자·콜론에 붙어 있지 않은 토큰으로 있어야 한다("9:30"이 "19:30" 속에서 잡히면 안 된다). */
const answerHasClock = (answer, hour, minute) =>
    clockVariants(hour, minute).some(variant =>
        new RegExp(`(?<![\\d:])${escapeRegExp(variant)}(?![\\d])`).test(answer)
    );

// ------------------------------------------------------------------- 개별 검사

const OSCILLATORS = [
    { key: 'rsi', label: 'RSI', name: /RSI/i },
    {
        key: 'stochastic',
        label: 'stochastic %K',
        name: /스토캐스틱|stochastic/i,
    },
    { key: 'williamsR', label: 'Williams %R', name: /윌리엄스|williams/i },
    { key: 'cci', label: 'CCI', name: /CCI/i },
    { key: 'mfi', label: 'MFI', name: /MFI|머니\s*플로우/i },
];

// core가 쓰는 구간 기준(포함 비교). 도구가 `oscillatorZones`를 싣지 않는 옛 응답에서도 같은 판정을 하려는
// 평가용 기준표다 — A/B의 OLD 쪽에서 "다른 오실레이터를 말했는가"를 가려내려면 도구 필드에 기댈 수 없다.
const ZONE_LEVELS = {
    rsi: [70, 30],
    stochastic: [80, 20],
    williamsR: [-20, -80],
    cci: [100, -100],
    mfi: [80, 20],
};

const zoneOf = (key, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const [overbought, oversold] = ZONE_LEVELS[key];
    return value >= overbought
        ? 'overbought'
        : value <= oversold
          ? 'oversold'
          : 'neutral';
};

/** bars 도구 결과의 구간표. 저장된 `oscillatorZones`가 있으면 그것, 없으면 원값에서 같은 기준으로 만든다. */
export function storedOscillatorZones(transcript) {
    const result = parseToolResult(transcript, 'get_bars_indicators');
    const latest = result?.latest;
    if (typeof latest !== 'object' || latest === null) return null;
    if (typeof latest.oscillatorZones === 'object' && latest.oscillatorZones)
        return latest.oscillatorZones;
    return {
        rsi: zoneOf('rsi', latest.rsi),
        stochastic: zoneOf('stochastic', latest.stochastic?.percentK),
        williamsR: zoneOf('williamsR', latest.williamsR),
        cci: zoneOf('cci', latest.cci),
        mfi: zoneOf('mfi', latest.mfi),
    };
}

/** 저장된 구간이 중립이 아닌 오실레이터는 답변이 이름을 대야 한다. 중립인데 과매도·과매수라 부른 문장은 review. */
function oscillatorsNamed(_case, transcript) {
    const zones = storedOscillatorZones(transcript);
    if (zones === null)
        return {
            fails: [
                'osc: no readable get_bars_indicators result to check against',
            ],
            reviews: [],
        };
    const sentences = splitSentences(transcript.answer);
    const fails = OSCILLATORS.filter(
        ({ key, name }) =>
            (zones[key] === 'overbought' || zones[key] === 'oversold') &&
            !name.test(transcript.answer)
    ).map(
        ({ key, label }) =>
            `osc: ${label} is ${zones[key]} in the tool result but the answer never names it`
    );
    const reviews = OSCILLATORS.filter(
        ({ key }) => zones[key] === 'neutral'
    ).flatMap(({ label, name }) =>
        sentences
            .filter(
                s =>
                    name.test(s) &&
                    /과매도|과매수|oversold|overbought/i.test(s) &&
                    !/아닙|아니|않|없|중립|neutral|not\b/i.test(s)
            )
            .map(s => `osc: neutral ${label} may be called a zone: "${s}"`)
    );
    return { fails, reviews };
}

/** 수치가 처음 나오는 문장에 날짜·시각 토큰이 있어야 한다. */
function firstFigureHasDate(_case, transcript) {
    const first = splitSentences(transcript.answer).find(isFigureSentence);
    if (first === undefined)
        return {
            fails: [],
            reviews: ['asof: the answer has no figure sentence to check'],
        };
    return hasDateToken(first)
        ? { fails: [], reviews: [] }
        : {
              fails: [
                  `asof: the first figure sentence has no date or time token: "${first}"`,
              ],
              reviews: [],
          };
}

/** 도구가 준 `dividends.latestAmount`의 모든 자릿수가 답변에 그대로 있어야 한다(센트로 반올림 금지). */
function dividendVerbatim(_case, transcript) {
    const amount = parseToolResult(transcript, 'get_fundamentals')?.dividends
        ?.latestAmount;
    if (typeof amount !== 'number')
        return {
            fails: [],
            reviews: ['div: no dividends.latestAmount in the stored result'],
        };
    const text = String(amount);
    const decimals = text.split('.')[1]?.length ?? 0;
    return {
        fails: transcript.answer.includes(text)
            ? []
            : [
                  `div: latestAmount ${text} does not appear verbatim in the answer`,
              ],
        reviews:
            decimals < 3
                ? [
                      `div: latestAmount ${text} has ${decimals} decimals, so this case does not exercise rounding`,
                  ]
                : [],
    };
}

/** 구하지 못한 부분을 "찾아볼까요"로 미루는 문구가 없어야 한다. */
function noOffer(_case, transcript) {
    const found = splitSentences(transcript.answer).find(s => OFFER_RE.test(s));
    return {
        fails:
            found === undefined
                ? []
                : [`offer: the answer offers a lookup: "${found}"`],
        reviews: [],
    };
}

/**
 * 첫 결과(`get_investor_flows`)에 그 보유자(`case.holder`)가 없고 이 실행에서 web_search를 쓸 수 있었다면, 비어 있는
 * 부분을 그 도구로 찾아봐야 한다. 결과에 보유자가 이미 있거나, web_search가 이미 불렸거나, 쓸 수 없는 실행
 * (`transcript.webSearchAvailable === false` 또는 web_search 결과가 `unavailable`)이면 통과.
 */
function webSearchWhenMissing(testCase, transcript) {
    if (calledNames(transcript).has('web_search'))
        return { fails: [], reviews: [] };
    const flowsRow = transcript.toolRows.find(
        r => r.toolName === 'get_investor_flows'
    );
    const holder = String(testCase.holder ?? '').toLowerCase();
    if (
        holder !== '' &&
        flowsRow !== undefined &&
        flowsRow.content.toLowerCase().includes(holder)
    )
        return { fails: [], reviews: [] };
    const unavailable =
        transcript.webSearchAvailable === false ||
        transcript.toolRows.some(
            r => r.toolName === 'web_search' && /"unavailable"/.test(r.content)
        );
    return unavailable
        ? {
              fails: [],
              reviews: [
                  'search: web_search was unavailable in this run, so the missing holder could not be searched',
              ],
          }
        : {
              fails: [
                  `search: the first result lacks "${testCase.holder ?? '?'}" and web_search was available but not called`,
              ],
              reviews: [],
          };
}

/** 답변이 US 장 줄의 개장/마감 시각(`HH:MM`)을 그대로 말해야 한다. */
function clockBoundary(_case, transcript) {
    const note = parseTurnNote(transcript.turnContext);
    if (note === null || note.us === null)
        return {
            fails: [
                'clock: no readable US line in the note rebuilt from turn_at',
            ],
            reviews: [],
        };
    if (note.us.hour === null)
        return {
            fails: [],
            reviews: [`clock: the US line has no boundary (${note.us.state})`],
        };
    return answerHasClock(transcript.answer, note.us.hour, note.us.minute)
        ? { fails: [], reviews: [] }
        : {
              fails: [
                  `clock: the answer does not state the US boundary ${note.us.hour}:${note.us.minute} ${note.us.zone}`,
              ],
              reviews: [],
          };
}

/** conv 마지막 턴: 메모의 요일과 KRX 개장/마감 시각이 답변에 있어야 한다. 메모의 해당 줄이 없거나 깨졌으면 그 자체가 실패다. */
function weekdayAndKrxBoundary(_case, transcript) {
    const note = parseTurnNote(transcript.turnContext);
    if (note === null)
        return {
            fails: [
                'clock: no readable note rebuilt from turn_at on this turn',
            ],
            reviews: [],
        };
    const weekdayFails =
        note.weekdayEnglish === null
            ? ['clock: the note has no readable weekday on its local-time line']
            : mentionsWeekday(transcript.answer, note.weekdayEnglish)
              ? []
              : [
                    `clock: the answer does not say the weekday (${note.weekdayEnglish})`,
                ];
    if (note.kr === null)
        return {
            fails: [
                ...weekdayFails,
                'clock: the note has no readable Korean stocks (KRX) line',
            ],
            reviews: [],
        };
    if (note.kr.hour === null)
        return {
            fails: weekdayFails,
            reviews: [`clock: the KRX line has no boundary (${note.kr.state})`],
        };
    return {
        fails: [
            ...weekdayFails,
            ...(answerHasClock(transcript.answer, note.kr.hour, note.kr.minute)
                ? []
                : [
                      `clock: the answer does not state the KRX boundary ${note.kr.hour}:${note.kr.minute} KST`,
                  ]),
        ],
        reviews: [],
    };
}

/** 실적 케이스는 하드 실패 없이 사람이 볼 줄만: 남은 일수와 요일 표현을 메모·도구값과 나란히 보여 준다. */
function earningsReview(_case, transcript) {
    const result = parseToolResult(transcript, 'get_fundamentals');
    const days = result?.earnings?.daysToEarnings ?? result?.daysToEarnings;
    const note = parseTurnNote(transcript.turnContext);
    const mentionedDays = [
        ...transcript.answer.matchAll(/(\d+)\s*(?:일|days?)\b/g),
    ].map(m => m[1]);
    return {
        fails: [],
        reviews: [
            `earn: tool daysToEarnings=${days ?? 'n/a'}, answer day counts=[${mentionedDays.join(', ')}], note weekday=${note?.weekdayEnglish ?? 'n/a'}`,
        ],
    };
}

/** 턴 n ≥ 2: 첫 단계 cachedTokens가 직전 턴 마지막 단계의 전체 입력 − 192 이상이어야 한다(접두사 캐시). */
export const CACHE_TOLERANCE_TOKENS = 192;
function cachedPrefix(_case, transcript, previous) {
    if (previous === null || previous === undefined)
        return { fails: [], reviews: [] };
    const first = transcript.steps.at(0);
    const prevLast = previous.steps.at(-1);
    if (first === undefined || prevLast === undefined)
        return {
            fails: ['cache: a turn has no usage frame to compare'],
            reviews: [],
        };
    const needed =
        prevLast.promptTokens + prevLast.cachedTokens - CACHE_TOLERANCE_TOKENS;
    return first.cachedTokens >= needed
        ? { fails: [], reviews: [] }
        : {
              fails: [
                  `cache: step 1 cachedTokens ${first.cachedTokens} < previous last step ${prevLast.promptTokens} + ${prevLast.cachedTokens} - ${CACHE_TOLERANCE_TOKENS} = ${needed}`,
              ],
              reviews: [],
          };
}

export const CHECKS = {
    oscillatorsNamed,
    firstFigureHasDate,
    dividendVerbatim,
    noOffer,
    webSearchWhenMissing,
    clockBoundary,
    weekdayAndKrxBoundary,
    earningsReview,
    cachedPrefix,
};

/** mustCall·mustNotCall·턴 오류와 케이스가 이름으로 단 검사를 모두 돌려 합친다. */
export function runChecks(testCase, transcript, previous = null) {
    const called = calledNames(transcript);
    const base = {
        fails: [
            ...(transcript.error === null || transcript.error === undefined
                ? []
                : [`turn: the stream ended with error ${transcript.error}`]),
            ...(testCase.mustCall ?? [])
                .filter(name => !called.has(name))
                .map(name => `tool: ${name} was not called`),
            ...(testCase.mustNotCall ?? [])
                .filter(name => called.has(name))
                .map(name => `tool: ${name} must not be called`),
        ],
        reviews: [],
    };
    return (testCase.checks ?? []).reduce((acc, name) => {
        const check = CHECKS[name];
        if (check === undefined)
            return { ...acc, fails: [...acc.fails, `unknown check ${name}`] };
        const result = check(testCase, transcript, previous);
        return {
            fails: [...acc.fails, ...result.fails],
            reviews: [...acc.reviews, ...result.reviews],
        };
    }, base);
}

// ----------------------------------------------------- 실행기 보조(순수) 함수

/** 로컬(localhost·127.0.0.1·*.localhost) 주소인지. run.mjs가 운영을 건드리지 않도록 시작 때 거른다. */
export function isLocalUrl(value) {
    try {
        const { hostname } = new URL(value);
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.endsWith('.localhost')
        );
    } catch {
        return false;
    }
}

/** SSE 본문을 프레임 목록으로. heartbeat는 버리고, JSON이 아닌 data는 문자열로 둔다. */
export function parseSseFrames(text) {
    return text
        .split(/\r?\n\r?\n/)
        .map(block => {
            const lines = block.split(/\r?\n/);
            const event = lines
                .find(l => l.startsWith('event:'))
                ?.slice('event:'.length)
                .trim();
            const data = lines
                .filter(l => l.startsWith('data:'))
                .map(l => l.slice('data:'.length).trim())
                .join('\n');
            if (event === undefined || event === 'heartbeat') return null;
            try {
                return { event, data: JSON.parse(data) };
            } catch {
                return { event, data };
            }
        })
        .filter(frame => frame !== null);
}

/**
 * 프레임과 DB 행으로 transcript를 만든다. DB에는 메모 문구가 아니라 그 시각(`turn_at`)만 있으므로, 모델이 본 메모는
 * `noteFor(turnAtIso)`가 core의 `buildAgentTurnContext`로 같은 시각·시간대·로케일·KRX 스펙으로 다시 만든다
 * (run.mjs가 넘긴다). 주지 않으면 메모는 null이다. 단계별 usage는 `steps` 필드가 없는 프레임만(끝에 한 번 오는
 * 합계 프레임은 `steps`·`ms`가 있어 단계가 아니다).
 */
export function buildTranscript({
    question,
    frames,
    rows,
    noteFor = /** @type {(turnAt: string) => string | null} */ (() => null),
    webSearchAvailable = true,
}) {
    const meta = frames.find(f => f.event === 'meta')?.data ?? {};
    const done = frames.find(f => f.event === 'done')?.data ?? null;
    const errorFrame = frames.find(f => f.event === 'error')?.data ?? null;
    const turnAtValue = rows.find(r => r.id === meta.userMessageId)?.turnAt;
    const turnAt =
        turnAtValue instanceof Date
            ? turnAtValue.toISOString()
            : (turnAtValue ?? null);
    const streamedText = frames
        .filter(f => f.event === 'text')
        .map(f => f.data?.delta ?? '')
        .join('');
    return {
        question,
        conversationId: meta.conversationId ?? null,
        answer: typeof done?.body === 'string' ? done.body : streamedText,
        error: errorFrame === null ? null : (errorFrame.code ?? 'unknown'),
        toolCalls: frames
            .filter(f => f.event === 'tool_start')
            .map(f => ({
                id: f.data.id,
                name: f.data.name,
                args: f.data.args,
            })),
        toolRows: rows
            .filter(
                r => r.role === 'tool' && r.seq > (meta.userMessageSeq ?? 0)
            )
            .map(r => ({ toolName: r.toolName, content: r.content })),
        turnAt: turnAt ?? null,
        turnContext: turnAt ? noteFor(turnAt) : null,
        webSearchAvailable,
        steps: frames
            .filter(
                f =>
                    f.event === 'usage' &&
                    f.data?.usage &&
                    !('steps' in f.data.usage)
            )
            .map(f => ({
                promptTokens: f.data.usage.promptTokens ?? 0,
                cachedTokens: f.data.usage.cachedTokens ?? 0,
            })),
    };
}

/** 두 실행 결과(`run.mjs --out`)를 케이스별로 견준 한 줄 요약. OLD가 부른 도구를 NEW가 빠뜨리면 회귀로 표시한다. */
export function compareRuns(oldRun, newRun) {
    const byId = run => new Map(run.results.map(r => [r.id, r]));
    const oldById = byId(oldRun);
    return newRun.results.map(entry => {
        const before = oldById.get(entry.id);
        const names = result =>
            new Set(result.turns.flatMap(t => t.toolCalls.map(c => c.name)));
        const oldTools = before === undefined ? new Set() : names(before);
        const newTools = names(entry);
        return {
            id: entry.id,
            oldFails: before?.fails.length ?? null,
            newFails: entry.fails.length,
            droppedTools: [...oldTools].filter(name => !newTools.has(name)),
            addedTools: [...newTools].filter(name => !oldTools.has(name)),
        };
    });
}
