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

import {
    buildLevelLadder,
    readPutCallRatio,
    tallyEarningsReactions,
} from '@y0ngha/siglens-core';

/** 평가가 질문을 보내는 시간대(run.mjs가 요청 헤더에 같은 값을 보낸다). 기간 시작(이번 주·1개월 전)은 이 시간대의 날짜다. */
export const EVAL_TIME_ZONE = 'Asia/Seoul';

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

// ------------------------------------------------- WP-08: 도구가 준 해석 사실을 답변이 따르는지

/** 인용한 값과 도구 값의 허용 오차(소수 둘째 자리 반올림 + 부동소수 여유). */
const PRICE_TOLERANCE = 0.01 + 1e-9;

/** 숫자 토큰("1,234.5", "+6.05")을 수로. 쉼표·부호·공백을 걷는다. */
const toNumber = text => Number(String(text).replace(/[,+\s]/g, ''));

/** 도구 결과(JSON 문자열) 행 중 `toolName`이고 파싱되는 것들. */
function parsedRows(transcript, toolName) {
    return transcript.toolRows
        .filter(r => r.toolName === toolName)
        .flatMap(r => {
            try {
                const parsed = JSON.parse(r.content);
                return typeof parsed === 'object' && parsed !== null
                    ? [parsed]
                    : [];
            } catch {
                return [];
            }
        });
}

const RISE_WORD = '(?:상승|올랐|올라|오른|올)';
const FALL_WORD = '(?:하락|내렸|내려|내린|떨어졌|떨어진|떨어)';
const COUNT_UNIT = '(?:번|회|차례|분기)';

/**
 * 답변이 말한 실적 반응 횟수: "N번 중 M번 상승/하락", "M번 올랐/내렸"을 모은다.
 * `of`는 "N번 중"의 N(없으면 null), `count`는 M, `dir`은 'up'/'down'.
 */
export function extractReactionCounts(answer) {
    const directions = `(${RISE_WORD}|${FALL_WORD})`;
    const ofPattern = new RegExp(
        String.raw`(\d+)\s*${COUNT_UNIT}\s*중\s*(\d+)\s*${COUNT_UNIT}\s*(?:이|가|은|는)?\s*${directions}`,
        'g'
    );
    const plain = new RegExp(
        String.raw`(\d+)\s*${COUNT_UNIT}\s*(?:이나|나)?\s*${directions}`,
        'g'
    );
    const dirOf = word =>
        new RegExp(`^${RISE_WORD}`).test(word) ? 'up' : 'down';
    const withOf = [...answer.matchAll(ofPattern)].map(m => ({
        of: Number(m[1]),
        count: Number(m[2]),
        dir: dirOf(m[3]),
    }));
    // "8번 중 5번 상승"의 "5번 상승"을 두 번 세지 않도록 앞 패턴이 잡은 구간을 지우고 센다.
    const withoutOf = [...answer.replace(ofPattern, ' ').matchAll(plain)].map(
        m => ({ of: null, count: Number(m[1]), dir: dirOf(m[2]) })
    );
    return [...withOf, ...withoutOf];
}

/** "가장 크게 오른/최대 상승 ... N%"의 N과 방향. */
export function extractReactionExtremes(answer) {
    const rise = new RegExp(
        String.raw`(?:가장\s*크게\s*${RISE_WORD}|가장\s*큰\s*상승(?:폭)?|최대\s*상승(?:폭)?|최고\s*상승)[^\d\n+\-]{0,14}([+\-]?\d+(?:\.\d+)?)\s*%`,
        'g'
    );
    const fall = new RegExp(
        String.raw`(?:가장\s*크게\s*${FALL_WORD}|가장\s*큰\s*(?:하락|낙)(?:폭)?|최대\s*(?:하락|낙)(?:폭)?|최대\s*낙폭)[^\d\n+\-]{0,14}([+\-]?\d+(?:\.\d+)?)\s*%`,
        'g'
    );
    return [
        ...[...answer.matchAll(rise)].map(m => ({
            dir: 'up',
            value: Math.abs(toNumber(m[1])),
        })),
        ...[...answer.matchAll(fall)].map(m => ({
            dir: 'down',
            value: Math.abs(toNumber(m[1])),
        })),
    ];
}

/**
 * 실적 반응 횟수·최대 변동이 도구의 `earningsReactionTally`와 같아야 한다. 센 횟수(N번 중 M번)와 "가장 크게 오른/내린"
 * 값이 틀리면 하드 실패다(모델이 목록을 직접 세다 틀린 것이 이 필드를 만든 이유). 값이 없으면 평가 불가.
 */
function earningsTally(_case, transcript) {
    // NEW 결과는 도구가 낸 `earningsReactionTally`를 그대로 쓰고, OLD 결과(필드 없음)는 기록된 `earningsReactions`에서 core 함수로
    // 같은 기준값을 계산한다 — 두 변형이 같은 정답으로 판정된다.
    const tally = parsedRows(transcript, 'get_fundamentals')
        .map(r =>
            typeof r.earningsReactionTally === 'object' &&
            r.earningsReactionTally !== null
                ? r.earningsReactionTally
                : Array.isArray(r.earningsReactions)
                  ? tallyEarningsReactions(r.earningsReactions)
                  : undefined
        )
        .find(t => t !== undefined);
    if (tally === undefined)
        return {
            fails: [],
            reviews: [],
            notEvaluable: [
                'tally: earningsReactionTally is missing from the stored get_fundamentals result',
            ],
        };
    const fails = [
        ...extractReactionCounts(transcript.answer).flatMap(c => {
            const expected = c.dir === 'up' ? tally.up : tally.down;
            return [
                ...(c.count === expected
                    ? []
                    : [
                          `tally: the answer says ${c.count} ${c.dir === 'up' ? 'rises' : 'falls'} but the tally has ${expected}`,
                      ]),
                ...(c.of === null || c.of === tally.measured
                    ? []
                    : [
                          `tally: the answer says "${c.of} reports" but the tally measured ${tally.measured}`,
                      ]),
            ];
        }),
        ...extractReactionExtremes(transcript.answer).flatMap(e => {
            const extreme =
                e.dir === 'up' ? tally.largestRise : tally.largestFall;
            const label = e.dir === 'up' ? 'largest rise' : 'largest fall';
            if (extreme === null || extreme === undefined)
                return [
                    `tally: the answer quotes a ${label} but the tally has none`,
                ];
            return Math.abs(Math.abs(extreme.movePct) - e.value) <=
                PRICE_TOLERANCE
                ? []
                : [
                      `tally: the answer's ${label} ${e.value}% differs from the tally's ${extreme.movePct}%`,
                  ];
        }),
    ];
    return { fails, reviews: [] };
}

/** 답변이 "풋이 많다"고 말하는 문구와 "콜이 많다"고 말하는 문구. */
export const PUT_DOMINATES_RE =
    /풋(?:\s*옵션)?(?:이|은|가)?\s*(?:콜보다\s*)?(?:더\s*)?(?:조금\s*|훨씬\s*)?(?:많|우위)|하락\s*(?:쪽\s*)?베팅(?:이|은)?\s*(?:조금\s*|훨씬\s*|더\s*)*많|풋\s*우위|puts?\s+(?:outnumber|dominate)/i;
export const CALL_DOMINATES_RE =
    /콜(?:\s*옵션)?(?:이|은|가)?\s*(?:풋보다\s*)?(?:더\s*)?(?:조금\s*|훨씬\s*)?(?:많|우위)|상승\s*(?:쪽\s*)?베팅(?:이|은)?\s*(?:조금\s*|훨씬\s*|더\s*)*많|콜\s*우위|calls?\s+(?:outnumber|dominate)/i;

/**
 * 풋/콜 비율을 말하는 문장이 비율이 가리키는 쪽과 반대로 말하면 하드 실패. 옵션(OI 기준)과 13F(명목 기준) 두 출처를 각자
 * 자기 비율 숫자가 들어 있는 문장에서만 판정한다(두 출처의 쪽이 달라도 서로 섞지 않는다). `even`은 판정하지 않는다.
 */
function putCallSide(_case, transcript) {
    const sources = [
        // 쪽은 도구가 낸 `reading`, 없으면(OLD 결과) 찍힌 비율에서 core 함수로 같은 기준값을 계산한다.
        ...parsedRows(transcript, 'get_options_summary').map(r => ({
            label: 'options',
            ratio: r.metrics?.putCallRatio,
            side:
                r.metrics?.putCallReading?.side ??
                readPutCallRatio(
                    r.metrics?.putCallRatio ?? null,
                    'open_interest'
                )?.side,
        })),
        ...parsedRows(transcript, 'get_investor_flows').map(r => ({
            label: '13F',
            ratio: r.institutional?.putCall?.putCallValueRatio,
            side:
                r.institutional?.putCall?.reading?.side ??
                readPutCallRatio(
                    r.institutional?.putCall?.putCallValueRatio ?? null,
                    'notional'
                )?.side,
        })),
    ].filter(
        src => typeof src.ratio === 'number' && typeof src.side === 'string'
    );
    if (sources.length === 0)
        return {
            fails: [],
            reviews: [],
            notEvaluable: [
                'putcall: no putCallReading in the stored options or flows result',
            ],
        };
    const sentences = splitSentences(transcript.answer);
    const results = sources.map(src => {
        const ratioToken = new RegExp(
            String.raw`(?<![\d.])${String(src.ratio).replace('.', String.raw`\.`)}(?![\d]|\.\d)`
        );
        const mentioning = sentences.filter(s => ratioToken.test(s));
        const wrong =
            src.side === 'more_calls'
                ? mentioning.filter(s => PUT_DOMINATES_RE.test(s))
                : src.side === 'more_puts'
                  ? mentioning.filter(s => CALL_DOMINATES_RE.test(s))
                  : [];
        return {
            fails: wrong.map(
                s =>
                    `putcall: ${src.label} side is ${src.side} (ratio ${src.ratio}) but the answer says the opposite: "${s}"`
            ),
            reviews:
                mentioning.length === 0
                    ? [
                          `putcall: the answer never quotes the ${src.label} ratio ${src.ratio}, so its side was not checked`,
                      ]
                    : [],
        };
    });
    return {
        fails: results.flatMap(r => r.fails),
        reviews: results.flatMap(r => r.reviews),
    };
}

const NEAREST_ROLE_RE = /가장\s*가까운\s*(지지|저항)(?:선|대|가격|레벨)?/g;
/** 역할 말 뒤에서 가격을 찾는 범위(문자 수). */
const NEAREST_PRICE_REACH = 40;
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;
/** 수 뒤에 붙어 기간·개수를 나타내는 단위: "20일 평균선(98.5)"의 20은 가격이 아니다. */
const COUNT_UNIT_AFTER_RE = /^\s*(?:일|주|개월)/;

/** "가장 가까운 지지/저항" 뒤 같은 문장 안에서 기간 단위(일·주·개월)가 붙지 않은 첫 수를 가격으로 읽는다. */
export function extractNearestClaims(answer) {
    return [...answer.matchAll(NEAREST_ROLE_RE)].flatMap(m => {
        const tail = answer
            .slice(
                m.index + m[0].length,
                m.index + m[0].length + NEAREST_PRICE_REACH
            )
            .split('\n')[0];
        const price = [...tail.matchAll(NUMBER_RE)].find(
            n => !COUNT_UNIT_AFTER_RE.test(tail.slice(n.index + n[0].length))
        );
        return price === undefined
            ? []
            : [
                  {
                      role: m[1] === '저항' ? 'resistance' : 'support',
                      value: toNumber(price[0]),
                  },
              ];
    });
}

/** 기록된 분석 결과의 레벨(지지·저항·POC·목표·손절)을 core 후보 모양으로. 차트 기준(52주·평균)은 이 결과에 없다. */
function analysisCandidates(analysis) {
    const price = v => (typeof v === 'number' ? [v] : []);
    const levelKind = (levels, kind) =>
        (levels ?? []).flatMap(l =>
            price(l?.price).map(p => ({ price: p, kind }))
        );
    return [
        ...levelKind(analysis?.keyLevels?.support, 'analysis_support'),
        ...levelKind(analysis?.keyLevels?.resistance, 'analysis_resistance'),
        ...price(analysis?.keyLevels?.poc?.price).map(p => ({
            price: p,
            kind: 'analysis_poc',
        })),
        ...[
            analysis?.priceTargets?.bullish,
            analysis?.priceTargets?.bearish,
        ].flatMap(sc => levelKind(sc?.targets, 'analysis_target')),
        ...price(analysis?.actionRecommendation?.stopLoss).map(p => ({
            price: p,
            kind: 'analysis_stop',
        })),
    ];
}

const CLOSER_RESISTANCE_RE =
    /저항(?:선|대)?(?:이|은|가)?\s*(?:더\s*)?가(?:깝|까워|까운)/;
const CLOSER_SUPPORT_RE =
    /지지(?:선|대)?(?:이|은|가)?\s*(?:더\s*)?가(?:깝|까워|까운)/;

/**
 * `get_cached_analysis.sinceAnalysis.levelLadder` 기준: "가장 가까운 지지/저항" 뒤의 숫자는 아래(below)/위(above)의 첫 칸
 * 가격(±0.01)이어야 하고, 한 답변에서 같은 역할에 서로 다른 숫자가 둘 있으면 안 되며, "저항이 더 가깝다" 같은 말은
 * `closer`와 맞아야 한다. 사다리가 없으면 평가 불가.
 */
function levelsNearest(_case, transcript) {
    // NEW 결과는 도구가 낸 `levelLadder`, OLD 결과(사다리 없음)는 기록된 분석 레벨과 `priceNow`로 core `buildLevelLadder`를 불러
    // 같은 기준값을 만든다(차트 기준 없이 분석 레벨만 — 아래 review 줄이 그 사실을 알린다).
    const recorded = parsedRows(transcript, 'get_cached_analysis');
    const toolLadder = recorded
        .map(r => r.sinceAnalysis?.levelLadder)
        .find(l => typeof l === 'object' && l !== null);
    const rebuilt =
        toolLadder !== undefined
            ? undefined
            : recorded
                  .map(r =>
                      typeof r.sinceAnalysis?.priceNow === 'number'
                          ? buildLevelLadder(
                                r.sinceAnalysis.priceNow,
                                analysisCandidates(r.analysis)
                            )
                          : null
                  )
                  .find(l => l !== null && l !== undefined);
    const ladder = toolLadder ?? rebuilt;
    if (ladder === undefined)
        return {
            fails: [],
            reviews: [],
            notEvaluable: [
                'levels: no levelLadder, and no analysis levels with priceNow to rebuild one from, in the stored get_cached_analysis result',
            ],
        };
    const rebuiltReview =
        rebuilt === undefined
            ? []
            : [
                  'levels: reference ladder rebuilt from the recorded analysis levels (no chart references: 52-week, 20-day, averages)',
              ];
    const claims = extractNearestClaims(transcript.answer);
    const expected = {
        resistance: ladder.above?.[0]?.price,
        support: ladder.below?.[0]?.price,
    };
    const roleLabel = {
        resistance: 'nearest resistance',
        support: 'nearest support',
    };
    const wrongNumbers = claims
        .filter(
            c =>
                typeof expected[c.role] !== 'number' ||
                Math.abs(c.value - expected[c.role]) > PRICE_TOLERANCE
        )
        .map(
            c =>
                `levels: the answer's ${roleLabel[c.role]} is ${c.value} but the ladder's is ${expected[c.role] ?? 'none'}`
        );
    const conflicting = ['resistance', 'support'].flatMap(role => {
        const values = [
            ...new Set(claims.filter(c => c.role === role).map(c => c.value)),
        ];
        return values.length > 1
            ? [
                  `levels: two different numbers in the ${roleLabel[role]} role: ${values.join(', ')}`,
              ]
            : [];
    });
    const saysResistanceCloser = CLOSER_RESISTANCE_RE.test(transcript.answer);
    const saysSupportCloser = CLOSER_SUPPORT_RE.test(transcript.answer);
    const closerFails = [
        ...(saysResistanceCloser && ladder.closer === 'below'
            ? [
                  'levels: the answer says the resistance is closer but the ladder says below (support) is',
              ]
            : []),
        ...(saysSupportCloser && ladder.closer === 'above'
            ? [
                  'levels: the answer says the support is closer but the ladder says above (resistance) is',
              ]
            : []),
    ];
    const closerReviews =
        (saysResistanceCloser || saysSupportCloser) &&
        (ladder.closer === 'equal' || ladder.closer === null)
            ? [
                  `levels: the answer says which level is closer but the ladder's closer is ${ladder.closer}`,
              ]
            : [];
    return {
        fails: [...wrongNumbers, ...conflicting, ...closerFails],
        reviews: [...rebuiltReview, ...closerReviews],
    };
}

/** 기간 시작 질문 모양: month = "최근 1개월"(한 달 전 같은 날), week = "이번 주"(그 주 월요일). */
const PERIOD_START_TOLERANCE_DAYS = 3;
const MS_PER_DAY = 86_400_000;

/** `turnAt` 기준 기간 시작일(UTC 날짜 `YYYY-MM-DD`). 알 수 없으면 null. */
export function periodStartFor(kind, turnAt) {
    const turn = Date.parse(turnAt ?? '');
    if (Number.isNaN(turn)) return null;
    // 질문이 간 시간대(`EVAL_TIME_ZONE`)의 달력 날짜로 센다: UTC로 세면 한국 월요일 새벽이 전 주 일요일로 읽힌다.
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: EVAL_TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
            .formatToParts(new Date(turn))
            .map(p => [p.type, p.value])
    );
    const local = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day)
    );
    if (kind === 'week') {
        const dow = (new Date(local).getUTCDay() + 6) % 7; // Monday = 0
        return new Date(local - dow * MS_PER_DAY).toISOString().slice(0, 10);
    }
    if (kind === 'month') {
        const d = new Date(local);
        return new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, d.getUTCDate())
        )
            .toISOString()
            .slice(0, 10);
    }
    return null;
}

/** "M월 D일"·`YYYY-MM-DD`로 쓴 날짜를 `YYYY-MM-DD`로(연도는 `year`). */
export function datesIn(text, year) {
    const iso = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].map(
        m => m[0]
    );
    const korean = [...text.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)].map(
        m =>
            `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
    );
    return [...new Set([...iso, ...korean])];
}

const CAUSE_RE = /때문|영향|여파|원인|탓|이유|로 인해|으로 인해|덕분|힘입|따라/;

/** 답변이 인용한 기사: 제목 전체(또는 앞 15자)가 답변에 있는 도구 항목. */
function quotedItems(answer, items) {
    return items.filter(item => {
        const title = String(item.title ?? '');
        return title.length >= 8 && answer.includes(title.slice(0, 15));
    });
}

/**
 * 뉴스·주가 흐름 케이스. 하드 실패: (1) 저장된 `get_news` 결과가 절단 봉투(`truncated:true`)이거나 JSON이 깨짐, (2) `get_news`를
 * `since` 없이 불렀거나 `since`가 기간 시작(`case.periodStart`: month/week)에서 ±3일 밖, (3) 답변이 어떤 날짜와 함께 인용한
 * 기사의 `session`이 그 날짜보다 늦음, (4) `session: null`(마지막 마감 뒤) 기사를 원인 표현과 함께 인용. 리뷰 줄: 답변이 말한
 * 날짜와 `priceMoves.moveDays`를 나란히.
 */
function newsAligned(testCase, transcript) {
    const parsed = transcript.toolRows
        .filter(r => r.toolName === 'get_news')
        .map(r => {
            try {
                return JSON.parse(r.content);
            } catch {
                return null;
            }
        });
    const cutFails = parsed.flatMap((p, i) =>
        p === null || p.truncated === true
            ? [
                  `news: get_news result #${i + 1} was stored cut (truncated or not JSON)`,
              ]
            : []
    );
    const start = periodStartFor(testCase.periodStart, transcript.turnAt);
    const bySymbol = transcript.toolCalls.filter(
        c => c.name === 'get_news' && typeof c.args?.symbol === 'string'
    );
    const sinceFails =
        start === null
            ? []
            : bySymbol.flatMap(c => {
                  const since = c.args?.since;
                  if (typeof since !== 'string')
                      return [
                          'news: get_news was called without since for a period question',
                      ];
                  const gap =
                      Math.abs(Date.parse(since) - Date.parse(start)) /
                      MS_PER_DAY;
                  return gap <= PERIOD_START_TOLERANCE_DAYS
                      ? []
                      : [
                            `news: since ${since} is ${Math.round(gap)} days from the period start ${start}`,
                        ];
              });
    const sinceNotEvaluable =
        bySymbol.length > 0 && start === null
            ? ['news: no turn time or periodStart, so since was not checked']
            : [];
    const symbolResults = parsed.filter(
        p => p !== null && p.priceMoves !== undefined
    );
    if (symbolResults.length === 0)
        return {
            fails: [...cutFails, ...sinceFails],
            reviews: [],
            notEvaluable: [
                ...sinceNotEvaluable,
                'news: no get_news result with priceMoves, so session alignment was not checked',
            ],
        };
    const items = symbolResults.flatMap(p =>
        Array.isArray(p.items) ? p.items : []
    );
    const year =
        (transcript.turnAt ?? '').slice(0, 4) ||
        String(new Date().getUTCFullYear());
    const sentences = splitSentences(transcript.answer);
    const alignFails = quotedItems(transcript.answer, items).flatMap(item => {
        const quoting = sentences.filter(s =>
            s.includes(String(item.title).slice(0, 15))
        );
        const asCause =
            item.session === null && quoting.some(s => CAUSE_RE.test(s))
                ? [
                      `news: an item with session null (after the last close) is presented as a cause: "${item.title}"`,
                  ]
                : [];
        const tooEarly =
            typeof item.session === 'string'
                ? quoting.flatMap(s =>
                      datesIn(s, year)
                          .filter(d => item.session > d)
                          .map(
                              d =>
                                  `news: the headline "${item.title}" belongs to session ${item.session} but is tied to ${d}`
                          )
                  )
                : [];
        return [...asCause, ...tooEarly];
    });
    const moveDates = symbolResults.flatMap(p =>
        (p.priceMoves?.moveDays ?? []).map(d => d.date)
    );
    const named = datesIn(transcript.answer, year);
    return {
        fails: [...cutFails, ...sinceFails, ...alignFails],
        reviews: [
            `news: answer dates=[${named.join(', ')}], priceMoves.moveDays=[${moveDates.join(', ')}]`,
        ],
        notEvaluable: sinceNotEvaluable,
    };
}

/** 한 숫자의 천 단위 묶음 표기("1,234,567")와 묶지 않은 표기. */
const digitForms = n => [n.toLocaleString('en-US'), String(n)];

/** `YYYY-MM-DD` 분기말의 한국어·영어 표기들. */
export function periodForms(period) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period ?? '');
    if (m === null) return [];
    const [year, month, day] = [m[1], Number(m[2]), Number(m[3])];
    const quarter = Math.ceil(month / 3);
    return [
        period,
        `${year}년 ${month}월 ${day}일`,
        `${month}월 ${day}일`,
        `${year}년 ${quarter}분기`,
        `${year}Q${quarter}`,
        `Q${quarter} ${year}`,
        `${quarter}분기`,
    ];
}

/**
 * 이름 지정 기관 보유 질문: 하드 실패 — 첫 `get_investor_flows` 호출에 `holder`가 없음, 조회가 `found`인데 답변에 보유 주수
 * (묶음 표기)나 기준 분기가 없음. 조회 결과가 `found`가 아니면 주수 검사는 평가 불가(상태를 말로 했는지는 리뷰 줄).
 */
function holderLookupUsed(_case, transcript) {
    const first = transcript.toolCalls.find(
        c => c.name === 'get_investor_flows'
    );
    if (first === undefined) return { fails: [], reviews: [] }; // mustCall이 이미 잡는다
    const fails =
        typeof first.args?.holder === 'string' &&
        first.args.holder.trim() !== ''
            ? []
            : [
                  'holder: the first get_investor_flows call has no holder argument',
              ];
    const lookup = parsedRows(transcript, 'get_investor_flows')
        .map(r => r.holderLookup)
        .find(l => typeof l === 'object' && l !== null);
    if (lookup === undefined)
        return {
            fails,
            reviews: [],
            notEvaluable: ['holder: no holderLookup in the stored result'],
        };
    if (lookup.status !== 'found')
        return {
            fails,
            reviews: [
                `holder: lookup status ${lookup.status}; check the answer says it in words`,
            ],
            notEvaluable: [
                `holder: share count not evaluable (status ${lookup.status})`,
            ],
        };
    const match = lookup.matches?.[0];
    const shareForms = digitForms(match?.shares ?? Number.NaN);
    return {
        fails: [
            ...fails,
            ...(shareForms.some(f => transcript.answer.includes(f))
                ? []
                : [
                      `holder: the answer lacks the matched share count ${shareForms[0]}`,
                  ]),
            ...(periodForms(lookup.period).some(f =>
                transcript.answer.includes(f)
            )
                ? []
                : [`holder: the answer lacks the period ${lookup.period}`]),
        ],
        reviews: [],
    };
}

/**
 * 부작용 지표(판정이 아니라 수치): 답변 길이, 수치 문장 수(평이한 수준의 숫자 개수 천장 ~15 비교용), 단계 수, 도구 호출 수,
 * web_search 수, core `findUngroundedNumbers`로 센 근거 없는 숫자 수. `findUngrounded`는 실행기가 core 함수를 넘긴다.
 *
 * @param {any} transcript
 * @param {((answer: string, toolResults: string[]) => string[]) | null} [findUngrounded]
 */
export function sideEffects(transcript, findUngrounded = null) {
    const figureCount = splitSentences(transcript.answer).filter(
        isFigureSentence
    ).length;
    return {
        answerChars: transcript.answer.length,
        figureSentences: figureCount,
        steps: transcript.steps.length,
        toolCalls: transcript.toolCalls.length,
        webSearches: transcript.toolCalls.filter(c => c.name === 'web_search')
            .length,
        ungroundedNumbers:
            findUngrounded === null
                ? null
                : findUngrounded(
                      transcript.answer,
                      transcript.toolRows.map(r => r.content)
                  ).length,
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
    earningsTally,
    putCallSide,
    levelsNearest,
    newsAligned,
    holderLookupUsed,
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
        const totals = result =>
            result?.sideEffects === undefined
                ? null
                : result.sideEffects.reduce(
                      (acc, e) => ({
                          answerChars: acc.answerChars + e.answerChars,
                          figureSentences:
                              acc.figureSentences + e.figureSentences,
                          steps: acc.steps + e.steps,
                          toolCalls: acc.toolCalls + e.toolCalls,
                          webSearches: acc.webSearches + e.webSearches,
                          ungroundedNumbers:
                              acc.ungroundedNumbers === null ||
                              e.ungroundedNumbers === null
                                  ? null
                                  : acc.ungroundedNumbers + e.ungroundedNumbers,
                      }),
                      {
                          answerChars: 0,
                          figureSentences: 0,
                          steps: 0,
                          toolCalls: 0,
                          webSearches: 0,
                          ungroundedNumbers: 0,
                      }
                  );
        return {
            oldNotEvaluable: before?.notEvaluable?.length ?? null,
            newNotEvaluable: entry.notEvaluable?.length ?? null,
            oldSideEffects: totals(before),
            newSideEffects: totals(entry),
            id: entry.id,
            oldFails: before?.fails.length ?? null,
            newFails: entry.fails.length,
            droppedTools: [...oldTools].filter(name => !newTools.has(name)),
            addedTools: [...newTools].filter(name => !oldTools.has(name)),
        };
    });
}
