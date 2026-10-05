/**
 * 레벨선 제목(`title`)을 담을 **오른쪽 여백**(px) 계산.
 *
 * lightweight-charts는 시리즈 `title`을 pane 안쪽 오른쪽 끝에 정렬해 그린다. 마지막
 * 봉이 그 끝까지 차 있으면 제목이 최근 캔들을 덮는다("돌파 기준 · 원형 바닥 …" 같은
 * 긴 제목일수록 더 많이). 시간축 `rightOffsetPixels`로 마지막 봉을 그만큼 왼쪽으로
 * 밀어 제목 자리를 비운다.
 */

/**
 * lightweight-charts 기본 글꼴(`layout.fontSize` 12, `layout.fontFamily`)과 **같아야**
 * 한다. 이 레포는 차트의 `layout`에서 글꼴을 바꾸지 않으므로 라이브러리 기본값이 곧
 * 실제 제목 글꼴이다 — 차트에서 `layout.fontFamily`/`fontSize`를 바꾸면 여기도 바꾼다.
 */
export const LEVEL_TITLE_FONT_SIZE_PX = 12;
export const LEVEL_TITLE_FONT = `${LEVEL_TITLE_FONT_SIZE_PX}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;

/** 가장 긴 제목 뒤에 더 두는 숨통 — 제목 라벨의 안쪽 패딩과 캔들 사이 간격. */
export const LEVEL_LABEL_GUTTER_MARGIN_PX = 12;

/** pane 폭 대비 여백 상한 — 긴 제목이 차트를 다 먹지 않게 한다. */
export const LEVEL_LABEL_GUTTER_MAX_RATIO = 0.3;

export type TextMeasurer = (text: string) => number;

/**
 * 제목들 중 가장 넓은 것 + 숨통만큼의 여백(px). 제목이 없으면(빈 문자열 포함) `0`.
 * 결과는 pane 폭의 `LEVEL_LABEL_GUTTER_MAX_RATIO`(30%)를 넘지 않고, 정수로 올린다.
 *
 * `paneWidth`가 0 이하(아직 못 쟀다)면 상한이 0이라 `0`이 된다 — 크기가 잡힌 뒤 다시
 * 계산되므로 안전하다.
 */
export function levelLabelGutterPx(
    titles: readonly string[],
    measure: TextMeasurer,
    paneWidth: number
): number {
    const widest = titles
        .filter(title => title !== '')
        .reduce((max, title) => Math.max(max, measure(title)), 0);
    if (widest === 0) return 0;
    const cap = Math.floor(
        Math.max(0, paneWidth) * LEVEL_LABEL_GUTTER_MAX_RATIO
    );
    return Math.min(Math.ceil(widest + LEVEL_LABEL_GUTTER_MARGIN_PX), cap);
}

/** 한글·일본어·중국어는 한 글자가 글꼴 크기만큼, 그 외는 대략 0.58배다. */
const WIDE_CHAR_THRESHOLD = 0x2e80;
const NARROW_CHAR_EM = 0.58;

/**
 * 2D 컨텍스트를 못 얻는 환경(jsdom·캔버스 차단)용 어림 폭. 실제 브라우저에서는
 * `createCanvasTextMeasurer`가 정확한 값을 준다.
 */
export function estimateTextWidth(text: string): number {
    return [...text].reduce(
        (sum, ch) =>
            sum +
            ((ch.codePointAt(0) ?? 0) >= WIDE_CHAR_THRESHOLD
                ? LEVEL_TITLE_FONT_SIZE_PX
                : LEVEL_TITLE_FONT_SIZE_PX * NARROW_CHAR_EM),
        0
    );
}

/**
 * 캔버스 `measureText`로 글자 폭을 재는 측정기. 캔버스·컨텍스트는 처음 쓸 때 한 번
 * 만든다(제목이 없는 차트는 만들지도 않는다). 컨텍스트를 못 얻으면 어림값으로 떨어진다.
 */
export function createCanvasTextMeasurer(font: string): TextMeasurer {
    let context: CanvasRenderingContext2D | null | undefined;
    return text => {
        if (context === undefined) {
            try {
                context =
                    typeof document === 'undefined'
                        ? null
                        : document.createElement('canvas').getContext('2d');
            } catch {
                context = null;
            }
            if (context) context.font = font;
        }
        return context
            ? context.measureText(text).width
            : estimateTextWidth(text);
    };
}
