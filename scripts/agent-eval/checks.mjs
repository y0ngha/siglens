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

/**
 * 마침표·물음표·느낌표 뒤 공백, 한국어 종결 `다.` 바로 뒤, 줄바꿈(글머리표·표 행·머리글 한 줄 포함)을 문장 경계로
 * 나눈다. 숫자 속 소수점(`44.74`)은 끊지 않는다.
 */
export function splitSentences(text) {
    return text
        .split(/(?<=[.!?。])\s+|(?<=다\.)(?=\S)|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/** 가격·등락률·지표값처럼 "수치"가 들어 있는 문장인지. 표 구분선·머리글은 제외한다. */
const FIGURE_RE = new RegExp(
    [
        String.raw`\d[\d,]*\.\d+`,
        String.raw`\d{1,3}(?:,\d{3})+`,
        String.raw`\d+\s*(?:%|퍼센트|달러|원|포인트)`,
        String.raw`\$\s?\d`,
        // 단위 없는 정수 판독값: "RSI 44", "종가 231"
        String.raw`(?:RSI|MFI|CCI|ADX|ATR|MACD|스토캐스틱|윌리엄스\s*%?R)[^\d\n]{0,12}-?\d`,
        String.raw`(?:종가|현재가|시가|고가|저가|주가|가격)[^\d\n]{0,8}\d`,
    ].join('|')
);
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

/**
 * `## Now` 메모에서 요일·현지 시각·장 상태 줄(`US`/`Korean`)을 읽는다. 장 줄의 다음 경계는 장 시간대 표기와, 사용자 시간대의
 * 표기가 다를 때 붙는 괄호 표기(`user`)를 모두 읽는다. 메모가 없으면 null, 줄이 없거나 모양이 다르면 그 줄은 null.
 */
export function parseTurnNote(note) {
    if (typeof note !== 'string') return null;
    const zone = '[A-Za-z0-9+:-]+';
    const marketLine = label => {
        const match = note.match(
            new RegExp(
                `^- ${label}[^:\\n]*: ([^;\\n]+?)(?:; (opens|closes) (\\w{3}) (\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2}) (${zone})(?: \\((\\w{3}) (\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2}) (${zone})\\))?)?(?: \\(in [^)]*\\))?$`,
                'm'
            )
        );
        if (match === null) return null;
        const [
            ,
            state,
            verb,
            weekday,
            date,
            hour,
            minute,
            marketZone,
            uWeekday,
            uDate,
            uHour,
            uMinute,
            uZone,
        ] = match;
        return {
            state,
            verb: verb ?? null,
            weekday: weekday ?? null,
            date: date ?? null,
            hour: hour ?? null,
            minute: minute ?? null,
            zone: marketZone ?? null,
            user:
                uHour === undefined
                    ? null
                    : {
                          weekday: uWeekday,
                          date: uDate,
                          hour: uHour,
                          minute: uMinute,
                          zone: uZone,
                      },
        };
    };
    const local = note.match(
        /^- User's local time: (\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}) (\S+) \((\w+); this week /m
    );
    return {
        weekdayEnglish: local?.[5] ?? null,
        local:
            local === null
                ? null
                : { hour: local[2], minute: local[3], zone: local[4] },
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

const pad2 = n => String(n).padStart(2, '0');
const AM_WORDS = '오전|새벽|아침';
const PM_WORDS = '오후|저녁|밤|낮';

/**
 * 한 시각(24시간 `hour:minute`)을 답변이 쓸 수 있는 꼴의 정규식 원문으로 편다: `15:30`·`3:30`, `15시 30분`·`15시 반`,
 * 오전/오후(새벽·아침·저녁·밤·낮) 12시간 `오후 3:30`·`오후 3시 30분`·`오후 3시 반`. 접두어 없는 `3시 30분`은 15시와 같다고
 * 보지 않는다(모호하면 틀린 것). 숫자·콜론에 붙은 토큰("19:30" 속 "9:30")은 세지 않는다.
 */
export function clockPatterns(hour, minute) {
    const h = Number(hour);
    const m = Number(minute);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const words = h < 12 ? AM_WORDS : PM_WORDS;
    const tail =
        m === 0
            ? String.raw`(?!\s*(?:\d+분|반))`
            : m === 30
              ? String.raw`\s*(?:30분|반)(?!\d)`
              : String.raw`\s*0?${m}분`;
    const colon = String.raw`:${pad2(m)}(?!\d)`;
    // 24시간 꼴 앞에 오전/오후 같은 말이 붙어 있으면 12시간 꼴로 읽어야 하므로 여기서는 세지 않는다("오후 9시"는 21시).
    const noWord = String.raw`(?<!(?:${AM_WORDS}|${PM_WORDS})\s*)`;
    return [
        String.raw`${noWord}(?<![\d:])0?${h}${colon}`,
        String.raw`(?:${words})\s*0?${h12}${colon}`,
        String.raw`${noWord}(?<![\d:])0?${h}시${tail}`,
        String.raw`(?:${words})\s*0?${h12}시${tail}`,
    ];
}

/** 답변에 그 시각이 어떤 꼴로든 맞게 적혀 있는지. */
export const answerHasClock = (answer, hour, minute) =>
    clockPatterns(hour, minute).some(pattern =>
        new RegExp(pattern).test(answer)
    );

/** 장 줄의 다음 경계를 맞는 표기 목록으로: 장 시간대 시각, 그리고 사용자 시간대 시각(있으면). */
const boundaryClocks = line =>
    line === null || line.hour === null
        ? []
        : [
              { hour: line.hour, minute: line.minute, zone: line.zone },
              ...(line.user === null
                  ? []
                  : [
                        {
                            hour: line.user.hour,
                            minute: line.user.minute,
                            zone: line.user.zone,
                        },
                    ]),
          ];

const describeClocks = clocks =>
    clocks.map(c => `${c.hour}:${c.minute} ${c.zone}`).join(' / ');

const TIME_TOKEN_RE = new RegExp(
    String.raw`(?:(${AM_WORDS}|${PM_WORDS})\s*)?(?<![\d:])(\d{1,2})(?::(\d{2})(?!\d)|시(?:\s*(?:(\d{1,2})분|(반)))?)`,
    'g'
);

/** 문장 속 시각 토큰을 하루 중 분(minutes of day)으로. 접두어 없는 `N시`는 24시간제로 읽는다. */
export function extractClockTimes(text) {
    return [...text.matchAll(TIME_TOKEN_RE)].map(match => {
        const [, word, hourText, colonMinute, siMinute, half] = match;
        const base = Number(hourText);
        const pm = word !== undefined && new RegExp(PM_WORDS).test(word);
        const am = word !== undefined && !pm;
        const hour24 =
            pm && base < 12 ? base + 12 : am && base === 12 ? 0 : base;
        const minute =
            colonMinute !== undefined
                ? Number(colonMinute)
                : half !== undefined
                  ? 30
                  : Number(siMinute ?? 0);
        return {
            index: match.index,
            text: match[0],
            minutes: hour24 * 60 + minute,
        };
    });
}

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

const ZONE_WORD_RE = /과매도|과매수|oversold|overbought/i;
const SIGNAL_TOKEN = {
    rsi: /rsi/,
    stochastic: /stoch/,
    williamsR: /williams|willr/,
    cci: /cci/,
    mfi: /mfi/,
};
// 신호 이름 안에서 구간 단어가 뒤따르는 말: "MFI 과매수 후 반전", "RSI 과매도 이탈 신호"
const SIGNAL_LABEL_TAIL =
    '\\s*(?:후|이후|에서|반전|다이버전스|신호|시그널|이탈|복귀|진입|돌파)';

/** 그 오실레이터가 구간 단어를 이름에 담은 신호를 도구가 돌려줬는지(`signals[].type`, 예: `mfi_overbought_reversal`). */
function hasZoneNamedSignal(transcript, key) {
    const signals = parseToolResult(transcript, 'get_bars_indicators')?.signals;
    return (
        Array.isArray(signals) &&
        signals.some(
            sig =>
                typeof sig?.type === 'string' &&
                SIGNAL_TOKEN[key].test(sig.type.toLowerCase()) &&
                /overbought|oversold/.test(sig.type.toLowerCase())
        )
    );
}

/**
 * 문장에서 도구가 돌려준 신호 이름 속 구간 단어를 걷어 낸다. 도구 결과에 그 오실레이터의 구간 신호가 없으면
 * (`hasSignal` false) 문장을 그대로 둔다 — 이름이 도구에서 온 것이 아니면 구간 주장이다.
 */
function withoutSignalLabels(sentence, name, hasSignal) {
    if (!hasSignal) return sentence;
    return sentence.replace(
        new RegExp(
            `(?:${name.source})[^.()]{0,6}(?:과매수|과매도)${SIGNAL_LABEL_TAIL}`,
            'gi'
        ),
        ''
    );
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
    ).flatMap(({ key, label, name }) =>
        sentences
            .filter(
                s =>
                    name.test(s) &&
                    ZONE_WORD_RE.test(
                        withoutSignalLabels(
                            s,
                            name,
                            hasZoneNamedSignal(transcript, key)
                        )
                    ) &&
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
    if (found === undefined) return { fails: [], reviews: [] };
    // 이 실행에서 web_search를 내놓지 않았다면 "찾아볼까요"는 도구가 있었는데 미룬 것이 아니다.
    return transcript.webSearchAvailable === false
        ? {
              fails: [],
              reviews: [],
              notEvaluable: [
                  `offer: not evaluable (web_search not offered); the answer says: "${found}"`,
              ],
          }
        : {
              fails: [`offer: the answer offers a lookup: "${found}"`],
              reviews: [],
          };
}

/**
 * 첫 결과(`get_investor_flows`)에 그 보유자(`case.holder`)가 없고 이 실행에서 web_search를 쓸 수 있었다면, 비어 있는
 * 부분을 그 도구로 찾아봐야 한다. 결과에 보유자가 이미 있거나, web_search가 이미 불렸거나, 쓸 수 없는 실행
 * (`transcript.webSearchAvailable === false` 또는 web_search 결과가 `unavailable`)이면 실패가 아니라 평가 불가다.
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
              reviews: [],
              notEvaluable: [
                  `search: not evaluable (web_search not offered); the first result lacks "${testCase.holder ?? '?'}"`,
              ],
          }
        : {
              fails: [
                  `search: the first result lacks "${testCase.holder ?? '?'}" and web_search ${transcript.webSearchAvailable === true ? 'was offered' : 'may have been offered (availability unknown)'} but was not called`,
              ],
              reviews: [],
          };
}

/**
 * 답변이 US 장 줄의 다음 경계 시각을 맞게 말해야 한다. 장 시간대(ET) 시각과 메모가 함께 적은 사용자 시간대 시각 중
 * 어느 쪽이든, 24시간·`H시 M분`·`H시 반`·오전/오후 어느 꼴이든 맞다. 다른 시각이면 실패.
 */
function clockBoundary(_case, transcript) {
    const note = parseTurnNote(transcript.turnContext);
    if (note === null || note.us === null)
        return {
            fails: [
                'clock: no readable US line in the note rebuilt from turn_at',
            ],
            reviews: [],
        };
    const clocks = boundaryClocks(note.us);
    if (clocks.length === 0)
        return {
            fails: [],
            reviews: [`clock: the US line has no boundary (${note.us.state})`],
        };
    return clocks.some(c => answerHasClock(transcript.answer, c.hour, c.minute))
        ? { fails: [], reviews: [] }
        : {
              fails: [
                  `clock: the answer does not state the US boundary as ${describeClocks(clocks)}`,
              ],
              reviews: [],
          };
}

/** conv 마지막 턴: 메모의 요일과 KRX 다음 경계(장 시간대·사용자 시간대 어느 표기든)가 답변에 있어야 한다. 메모의 해당 줄이 없거나 깨졌으면 그 자체가 실패다. */
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
    const clocks = boundaryClocks(note.kr);
    if (clocks.length === 0)
        return {
            fails: weekdayFails,
            reviews: [`clock: the KRX line has no boundary (${note.kr.state})`],
        };
    return {
        fails: [
            ...weekdayFails,
            ...(clocks.some(c =>
                answerHasClock(transcript.answer, c.hour, c.minute)
            )
                ? []
                : [
                      `clock: the answer does not state the KRX boundary as ${describeClocks(clocks)}`,
                  ]),
        ],
        reviews: [],
    };
}

const BOUNDARY_WORD_RE =
    /개장|마감|장\s*시작|열리|열려|열립|닫|종료|개시|\bopen|\bclose/i;
const KST_LABEL_RE = /한국\s*(?:시간|시각)|\bKST\b/g;
const LABEL_REACH_CHARS = 20;

/**
 * 답변이 한국시간/KST(사용자 시간대가 KST일 때)로 라벨을 단 경계 시각은 메모가 적은 값과 같아야 한다.
 * 개장·마감을 말하는 문장 안에서 라벨 가까이(20자 안)의 시각만 본다. 메모의 경계 시각과 현재 시각 말고 다른 값이면
 * 실패 — 시간대 환산 실수(예: ET 09:30을 "22:30 KST"로 씀)를 잡는다. 사용자 시간대가 KST가 아니면 메모에
 * KST 환산이 없어 판정할 수 없다.
 */
function noWrongZoneConversion(_case, transcript) {
    const note = parseTurnNote(transcript.turnContext);
    if (note === null)
        return {
            fails: [
                'clock: no readable note rebuilt from turn_at on this turn',
            ],
            reviews: [],
        };
    if (note.local?.zone !== 'KST')
        return {
            fails: [],
            reviews: [
                `clock: the note's user zone is ${note.local?.zone ?? 'unknown'}, so KST conversions are not in the note to compare`,
            ],
        };
    const allowed = new Set(
        [
            ...[note.us, note.kr].flatMap(line =>
                line === null || line.hour === null
                    ? []
                    : line.user !== null
                      ? [line.user]
                      : line.zone === 'KST'
                        ? [line]
                        : []
            ),
            note.local,
        ].map(c => Number(c.hour) * 60 + Number(c.minute))
    );
    const fails = splitSentences(transcript.answer)
        .filter(sentence => BOUNDARY_WORD_RE.test(sentence))
        .flatMap(sentence => {
            const times = extractClockTimes(sentence);
            return [...sentence.matchAll(KST_LABEL_RE)].flatMap(label => {
                const near = times
                    .map(t => ({
                        ...t,
                        distance: Math.abs(t.index - label.index),
                    }))
                    .filter(t => t.distance <= LABEL_REACH_CHARS)
                    .toSorted((a, b) => a.distance - b.distance)[0];
                return near === undefined || allowed.has(near.minutes)
                    ? []
                    : [
                          `clock: "${near.text}" is labelled KST but is not a boundary or the current time in the note ("${sentence}")`,
                      ];
            });
        });
    return { fails, reviews: [] };
}

const EARNINGS_WORD_RE = /실적|발표|earnings|report/i;
// 이동평균 기간·손익 기간은 "실적까지 남은 일수"가 아니다.
const NOT_A_COUNTDOWN = String.raw`(?!\s*(?:선|이동평균|손실|수익|간|동안))`;

/**
 * 실적 발표까지 남았다고 말한 일수만 모은다: "발표까지 N일", "N일 남", "N일 뒤/후", "in N days"(실적·발표를 말하는
 * 문장 안에서만). "200일선", "50일 이동평균", "10일 손실" 같은 다른 "N일"은 세지 않는다.
 */
export function extractEarningsDayCounts(answer) {
    const patterns = [
        new RegExp(
            String.raw`(?:발표|실적)[^.\d]{0,6}까지\s*(?:약\s*)?(\d+)\s*일${NOT_A_COUNTDOWN}`,
            'g'
        ),
        new RegExp(
            String.raw`(\d+)\s*일${NOT_A_COUNTDOWN}\s*(?:남|뒤|후)`,
            'g'
        ),
        /\bin\s+(\d+)\s+days?\b/gi,
    ];
    const found = splitSentences(answer)
        .filter(sentence => EARNINGS_WORD_RE.test(sentence))
        .flatMap(sentence =>
            patterns.flatMap(re => [...sentence.matchAll(re)].map(m => m[1]))
        );
    return [...new Set(found)];
}

/**
 * 실적 케이스: 하드 실패 없이 사람이 볼 줄만. 남은 일수는 `get_fundamentals` 결과의 `analyst.daysToEarnings`(도구 출력
 * 모양 그대로)에서 읽어 답변의 일수 표기와 나란히 보여 준다. 그 값이 없거나 숫자가 아니면 통과로 치지 않고
 * 평가 불가로 알린다.
 */
function earningsReview(_case, transcript) {
    const days = parseToolResult(transcript, 'get_fundamentals')?.analyst
        ?.daysToEarnings;
    if (typeof days !== 'number')
        return {
            fails: [],
            reviews: [],
            notEvaluable: [
                'earn: analyst.daysToEarnings is missing from the stored get_fundamentals result, so the day counts cannot be checked',
            ],
        };
    const note = parseTurnNote(transcript.turnContext);
    const mentionedDays = extractEarningsDayCounts(transcript.answer);
    return {
        fails: [],
        reviews: [
            `earn: tool daysToEarnings=${days}, answer day counts=[${mentionedDays.join(', ')}], note weekday=${note?.weekdayEnglish ?? 'n/a'}`,
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
    noWrongZoneConversion,
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
        notEvaluable: [],
    };
    return (testCase.checks ?? []).reduce((acc, name) => {
        const check = CHECKS[name];
        if (check === undefined)
            return { ...acc, fails: [...acc.fails, `unknown check ${name}`] };
        const result = check(testCase, transcript, previous);
        return {
            fails: [...acc.fails, ...result.fails],
            reviews: [...acc.reviews, ...result.reviews],
            notEvaluable: [...acc.notEvaluable, ...(result.notEvaluable ?? [])],
        };
    }, base);
}

// ----------------------------------------------------- 실행기 보조(순수) 함수

/**
 * `--only` 선택. 모르는 id는 거절하고(오타로 조용히 0건을 돌리지 않는다), conv는 `--cache` 없이는 못 고른다.
 * 반환: `{ selected, errors }` — errors가 비어 있지 않으면 실행하지 않는다.
 * @param {{ id: string, cache?: boolean }[]} cases
 * @param {string[] | undefined} only
 * @param {boolean} withCache
 */
export function selectCases(cases, only, withCache) {
    const known = cases.map(c => c.id);
    const unknown = (only ?? []).filter(id => !known.includes(id));
    const needsCache = (only ?? []).filter(id =>
        cases.some(c => c.id === id && c.cache && !withCache)
    );
    const errors = [
        ...(unknown.length > 0
            ? [
                  `unknown case id(s): ${unknown.join(', ')}. Valid ids: ${known.join(', ')}`,
              ]
            : []),
        ...needsCache.map(id => `case ${id} needs --cache`),
    ];
    return {
        selected: cases
            .filter(c => (only ? only.includes(c.id) : true))
            .filter(c => !c.cache || withCache),
        errors,
    };
}

/** 로컬(localhost·127.0.0.1·*.localhost) 주소인지. run.mjs가 운영을 건드리지 않도록 시작 때 거른다. */
export function isLocalUrl(value) {
    try {
        const { hostname } = new URL(value);
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
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
 * run.mjs가 서버 상태를 알려 주지 못할 때, 이 턴 자체에서 web_search 가용 여부를 읽는다: 모델이 불렀고 결과가
 * `unavailable`이 아니면 내놓은 것(true), `unavailable` 결과면 못 쓴 것(false), 둘 다 아니면 알 수 없다(null).
 */
export function inferWebSearchAvailable(frames, rows) {
    const unavailable = rows.some(
        r => r.toolName === 'web_search' && /"unavailable"/.test(r.content)
    );
    if (unavailable) return false;
    return frames.some(
        f => f.event === 'tool_start' && f.data?.name === 'web_search'
    )
        ? true
        : null;
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
    webSearchAvailable = null,
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
        webSearchAvailable:
            webSearchAvailable ?? inferWebSearchAvailable(frames, rows),
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
