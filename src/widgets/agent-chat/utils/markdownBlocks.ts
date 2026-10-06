/**
 * 마크다운을 빈 줄 기준의 **블록**으로 나눈다 — 블록마다 따로 파싱해 메모이즈하려는 것.
 *
 * 스트리밍 중 답변은 끝에서만 자란다. 통째로 파싱하면 조각마다 지금까지의 전부를 다시
 * 파싱해 O(n²)이 되지만, 블록으로 나누면 이미 끝난 블록의 입력 문자열이 그대로라
 * `memo`가 재파싱을 건너뛰고 마지막 블록만 다시 파싱된다.
 *
 * 그냥 `split('\n\n')`이 아닌 이유 — 빈 줄을 품는 구조를 깨면 안 된다:
 * - 펜스 코드 블록(```` ``` ````/`~~~`) 안의 빈 줄은 블록 경계가 아니다.
 * - 느슨한 목록(항목 사이 빈 줄)과 들여쓴 이어 쓰기는 앞 블록에 붙인다. 따로 파싱하면
 *   목록이 둘로 쪼개져 간격과 번호 매김이 달라진다. 앞 블록이 목록 항목으로 끝나지 않고
 *   **게으른 이어 쓰기**(항목 바로 밑의 들여쓰지 않은 줄 — CommonMark에서는 그 항목의
 *   문단에 이어진다)로 끝나도 목록은 아직 열려 있다(`- a\nlazy\n\n- b`는 `<ul>` 하나).
 *
 * 알려진 한계 — 정의가 본문과 다른 블록에 있으면 풀리지 않는다(블록마다 따로 파싱하므로):
 * - 참조식 링크 정의(`[x]: url`)
 * - 각주(`[^1]`와 `[^1]: …` 정의)
 * 이 답변 형식(모델 출력, 시스템 프롬프트가 인라인 링크를 쓴다)에서는 쓰지 않는다.
 */

/** 펜스 여는/닫는 줄: 0~3칸 들여쓰기 뒤 같은 문자 3개 이상. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/** 목록 항목 줄(들여쓰기 0~3칸). */
const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/;
/** 들여쓴 줄 — 앞 목록 항목의 이어 쓰기 후보. */
const INDENTED_RE = /^\s+\S/;
/**
 * 게으른 이어 쓰기가 될 수 **없는** 줄: 새 블록 구조를 여는 줄(제목·펜스·인용·표·구분선).
 * 목록 항목 뒤에 이런 줄이 오면 그 목록은 거기서 닫힌 것이다.
 */
const BLOCK_START_RE = /^ {0,3}(?:#{1,6}\s|`{3,}|~{3,}|>|\||(?:[-*_]\s*){3,}$)/;

/** 다음 블록이 빈 줄을 넘어 이어 붙을 수 있는 줄인가(목록 항목 또는 들여쓴 줄). */
function opensContinuation(line: string): boolean {
    return LIST_ITEM_RE.test(line) || INDENTED_RE.test(line);
}

/**
 * 블록이 열린 목록으로 끝나는가 — 마지막 목록 항목 뒤의 줄이 모두 그 항목의 이어 쓰기
 * (들여쓴 줄이나 게으른 이어 쓰기)일 때. 항목이 없거나 그 뒤에 새 구조가 열렸으면 닫힘.
 */
function endsInOpenList(block: readonly string[]): boolean {
    const lastItem = block.findLastIndex(line => LIST_ITEM_RE.test(line));
    if (lastItem === -1) return false;
    return block
        .slice(lastItem + 1)
        .every(line => line.trim() === '' || !BLOCK_START_RE.test(line));
}

export function splitMarkdownBlocks(markdown: string): string[] {
    const blocks: string[][] = [];
    let current: string[] = [];
    let fence: { char: string; length: number } | null = null;
    let sawBlank = false;

    for (const line of markdown.split('\n')) {
        const fenceMatch = FENCE_RE.exec(line);
        if (fence !== null) {
            current.push(line);
            const marker = fenceMatch?.[1];
            if (
                marker !== undefined &&
                marker[0] === fence.char &&
                marker.length >= fence.length &&
                line.trim() === marker
            )
                fence = null;
            continue;
        }
        if (line.trim() === '') {
            if (current.length > 0) {
                blocks.push(current);
                current = [];
            }
            sawBlank = true;
            continue;
        }
        if (current.length === 0 && sawBlank && blocks.length > 0) {
            const previous = blocks[blocks.length - 1]!;
            // 느슨한 목록·들여쓴 이어 쓰기: 열린 목록으로 끝난 앞 블록을 다시 열어 빈 줄째 붙인다.
            if (opensContinuation(line) && endsInOpenList(previous)) {
                blocks.pop();
                current = [...previous, ''];
            }
        }
        sawBlank = false;
        if (fenceMatch) {
            const marker = fenceMatch[1]!;
            fence = { char: marker[0]!, length: marker.length };
        }
        current.push(line);
    }
    if (current.length > 0) blocks.push(current);
    return blocks.map(lines => lines.join('\n'));
}
