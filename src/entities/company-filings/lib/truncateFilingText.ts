export interface TruncatedFilingText {
    text: string;
    truncated: boolean;
    totalChars: number;
}

/** 경계(줄바꿈·문장 끝)를 찾아 되돌아가는 최대 거리. 이보다 멀면 문장 중간이라도 `max`에서 자른다. */
const BOUNDARY_LOOKBACK = 500;
const SENTENCE_END = /[.!?]/;
const WHITESPACE = /\s/;

function endsWithHighSurrogate(text: string): boolean {
    const code = text.charCodeAt(text.length - 1);
    return code >= 0xd800 && code <= 0xdbff;
}

/**
 * 본문을 `max`자 안으로 자른다. `max` 직전 500자 안에 줄바꿈이나 문장 끝이 있으면 거기서 끊어 문장이 반쯤 잘린
 * 채 끝나지 않게 하고, 없으면 `max`에서 자른다(서로게이트 쌍은 쪼개지 않는다). `totalChars`는 자르기 전 길이다.
 */
export function truncateFilingText(
    text: string,
    max: number
): TruncatedFilingText {
    const totalChars = text.length;
    if (totalChars <= max) return { text, truncated: false, totalChars };
    // `max`번째 글자까지 보면 "정확히 max에서 문장이 끝나는" 경우도 경계로 잡힌다.
    const floor = Math.max(1, max - BOUNDARY_LOOKBACK);
    for (let i = max - 1; i >= floor; i--) {
        if (text[i] === '\n')
            return {
                text: text.slice(0, i).trimEnd(),
                truncated: true,
                totalChars,
            };
        if (SENTENCE_END.test(text[i]) && WHITESPACE.test(text[i + 1]))
            return {
                text: text.slice(0, i + 1),
                truncated: true,
                totalChars,
            };
    }
    const hard = text.slice(0, max);
    return {
        text: endsWithHighSurrogate(hard) ? hard.slice(0, -1) : hard,
        truncated: true,
        totalChars,
    };
}
