import { jsonrepair } from 'jsonrepair';

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

/**
 * LLM 응답을 감싼 ```json 펜스 코드 블록 하나를 벗기고 trim한 안쪽 텍스트를 돌려준다. 펜스가 없으면
 * 입력을 trim만 한다. `@y0ngha/siglens-core`의 JSON 헬퍼가 공개 API가 아니라 로컬에 미러링했다.
 */
export function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

/**
 * `jsonrepair`는 어떤 텍스트든 따옴표로 감싸 유효한 JSON으로 만들어 주므로, "JSON이 전혀 아닌 글"도
 * 문자열로 조용히 받아들인다. 복구는 이미 JSON처럼 생긴(`{` 또는 `[`로 시작하는) 후보로 제한해,
 * 완전한 쓰레기는 호출자에게 오류로 드러나게 한다.
 */
function looksJsonShaped(text: string): boolean {
    const head = text.trimStart()[0];
    return head === '{' || head === '[';
}

/**
 * JSON LLM 응답을 파싱한다. ```json``` 마크다운 펜스가 있으면 투명하게 벗긴다. 첫 파싱이 실패하면
 * `jsonrepair`로 한 번 더 시도한다(LLM이 가끔 잘리거나 trailing comma가 있거나 키에 따옴표가 없는 JSON을 낸다).
 * 실패하면 `source`를 라벨로 단 오류를 던지며, 반환값은 `unknown`이라 호출자가 직접 좁혀야 한다.
 */
export function parseJsonResponse(text: string, source: string): unknown {
    const candidate = stripMarkdownCodeBlock(text);
    try {
        return JSON.parse(candidate);
    } catch (error) {
        if (looksJsonShaped(candidate)) {
            try {
                return JSON.parse(jsonrepair(candidate));
            } catch {
                // 아래의 라벨 달린 throw로 넘어간다.
            }
        }
        throw new Error(`Failed to parse ${source} response as JSON`, {
            cause: error,
        });
    }
}
