import 'server-only';
import {
    AGENT_FOLLOW_UP_MARKER,
    splitAgentFollowUps,
} from '@y0ngha/siglens-core';

/**
 * 후속 질문 마커 줄(`[[followups]] A | B`)을 **서버에서** 걷어 내는 스트림 필터.
 *
 * 예전에는 클라이언트(`MessageList`)가 core의 `splitAgentFollowUps`를 직접 불렀다.
 * core는 CommonJS 한 덩어리라 함수 하나 때문에 전체 번들(전송 ~51KB)이 채팅 화면의
 * first-load JS에 실렸다. 그래서 나누기를 서버로 옮긴다 — 스트리밍 중에는 이 필터가
 * "아직 마커 줄일 수 있는" 끝줄을 보내지 않고, 턴이 끝나면 `done` 프레임이 최종
 * 본문(`body`)과 칩 항목(`followUps`)을 함께 싣는다.
 *
 * 규칙: 지금까지 받은 원문 `raw`에서 `splitAgentFollowUps(raw).body`가 "보여 줘도
 * 되는 본문"이다. 이미 보낸 길이보다 본문이 길어지면 늘어난 만큼만 내보낸다. 본문이
 * 짧아지는 경우(끝줄이 마커로 보이기 시작해 줄바꿈·공백이 잘린 경우)는 아무것도 보내지
 * 않는다. 본문과 보낸 글은 둘 다 같은 `raw`의 접두사라 한쪽은 반드시 다른 쪽의 접두사다
 * — 길이만 비교하면 되고, 내보낸 텍스트를 되돌릴 일은 없다(남는 건 끝 공백뿐이고,
 * `done`의 `body`가 최종값으로 덮는다).
 *
 * **증분 처리.** 조각마다 누적 원문 전체를 `splitAgentFollowUps`에 넘기면 답변 길이에
 * 대해 O(n²)이다. 그런데 그 판정은 **마지막 비어 있지 않은 줄**만 본다 — 그보다 앞의 줄은
 * 뒤에 내용 있는 줄이 생긴 순간 본문으로 확정된다. 그래서 새 조각의 글자만 훑어 그
 * 줄의 시작 위치와 첫 비공백 글자를 갱신하고, 그 줄이 `[`로 시작할 때만(마커가 될 수
 * 있는 유일한 경우: `[` 한 글자 또는 `[[`로 시작) 그 줄부터의 꼬리만 core에 넘긴다.
 * 숨겨질 때 본문 길이는 꼬리 앞부분의 끝 공백을 걷어 낸 길이로, core의 `trimEnd()`와 같다.
 */
export interface FollowUpTextFilter {
    /** 원문 조각을 받아 지금 클라이언트에 보내도 되는 조각을 돌려준다(없으면 `''`). */
    push(delta: string): string;
    /** 도구 호출이 시작되면 클라이언트가 그때까지의 글을 버린다 — 필터도 같이 비운다. */
    reset(): void;
}

/** `String.prototype.trim`이 걷어 내는 공백과 같은 집합. */
const WHITESPACE_RE = /\s/;

/** `text.slice(0, end).trimEnd().length` — 끝의 공백 구간만 거꾸로 훑는다. */
function trimmedEndLength(text: string, end: number): number {
    let length = end;
    while (length > 0 && WHITESPACE_RE.test(text[length - 1]!)) length -= 1;
    return length;
}

/** 필터의 증분 상태. 조각을 받을 때마다 새 조각의 글자만 반영한다. */
interface FilterState {
    raw: string;
    sentLength: number;
    /** 지금 쓰이는(마지막) 줄의 시작 위치와, 그 줄의 첫 비공백 글자(`''` = 아직 빈 줄). */
    lineStart: number;
    lineFirstChar: string;
    /** 마지막 비어 있지 않은 줄의 시작 위치와 첫 비공백 글자. */
    tailStart: number;
    tailFirstChar: string;
}

const initialState = (): FilterState => ({
    raw: '',
    sentLength: 0,
    lineStart: 0,
    lineFirstChar: '',
    tailStart: 0,
    tailFirstChar: '',
});

/** 새 조각의 글자만 훑어 줄 위치를 갱신한다(조각 길이에 비례). */
function scanDelta(state: FilterState, delta: string, offset: number): void {
    for (let i = 0; i < delta.length; i++) {
        const ch = delta[i]!;
        if (ch === '\n') {
            state.lineStart = offset + i + 1;
            state.lineFirstChar = '';
        } else if (state.lineFirstChar === '' && !WHITESPACE_RE.test(ch)) {
            state.lineFirstChar = ch;
            state.tailStart = state.lineStart;
            state.tailFirstChar = ch;
        }
    }
}

/** `splitAgentFollowUps(raw).body.length`와 같은 값 — 꼬리만 보고 구한다. */
function visibleLength(state: FilterState): number {
    if (state.tailFirstChar !== '[') return state.raw.length;
    const tail = state.raw.slice(state.tailStart);
    // 꼬리의 마지막 비어 있지 않은 줄은 첫 줄이므로, 숨겨지면 body가 꼬리와 달라진다.
    const hidden = splitAgentFollowUps(tail).body !== tail;
    return hidden
        ? trimmedEndLength(state.raw, state.tailStart)
        : state.raw.length;
}

export function createFollowUpTextFilter(): FollowUpTextFilter {
    let state = initialState();
    return {
        push(delta: string): string {
            const offset = state.raw.length;
            state.raw += delta;
            scanDelta(state, delta, offset);
            const bodyLength = visibleLength(state);
            if (bodyLength <= state.sentLength) return '';
            const next = state.raw.slice(state.sentLength, bodyLength);
            state.sentLength = bodyLength;
            return next;
        },
        reset(): void {
            state = initialState();
        },
    };
}

/** 칩 하나에 들어갈 수 있는 항목 수 — core `parseFollowUpItems`의 상한과 같다. */
const MAX_FOLLOW_UPS = 3;
/** 항목 하나의 최대 길이(코드 포인트) — core `parseFollowUpItems`의 상한과 같다. */
const MAX_FOLLOW_UP_CHARS = 60;

/**
 * 게스트 대화 기록의 답변 끝에 붙일 후속 질문 줄(`\n\n[[followups]] A | B`). 항목이
 * 하나도 남지 않으면 `''`.
 *
 * 클라이언트는 이제 마커 줄이 빠진 본문과 항목만 들고 있다. 게스트는 대화 기록을
 * 브라우저가 매 턴 보내는데, 그대로 넘기면 모델이 읽는 지난 답변에서 마커 줄이 사라져
 * (회원은 DB 원문이라 그대로 남는다) 모델이 후속 질문을 내지 않는 쪽으로 흉내 낼 수 있다.
 *
 * 항목은 게스트가 보낸 값이라 core가 파싱 때 거는 상한을 그대로 건다 — **먼저 3개로
 * 자르고**(긴 배열을 다 훑지 않는다) 항목마다 60자로 자른다. 구분자(`|`)와 줄바꿈은
 * 공백으로 바꿔 줄 형식이 깨지지 않게 한다. 길이가 이렇게 묶여 있어서 호출부가 본문
 * 상한 안에 이 줄 자리를 미리 비워 둘 수 있다.
 */
export function followUpLine(followUps: readonly string[]): string {
    const items = followUps
        .slice(0, MAX_FOLLOW_UPS)
        .map(item =>
            Array.from(
                item
                    .replace(/[|\r\n]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
            )
                .slice(0, MAX_FOLLOW_UP_CHARS)
                .join('')
                .trim()
        )
        .filter(item => item.length > 0);
    if (items.length === 0) return '';
    return `\n\n${AGENT_FOLLOW_UP_MARKER} ${items.join(' | ')}`;
}

/** 본문 뒤에 {@link followUpLine}을 붙인다. */
export function withFollowUpLine(
    content: string,
    followUps: readonly string[]
): string {
    return `${content}${followUpLine(followUps)}`;
}
