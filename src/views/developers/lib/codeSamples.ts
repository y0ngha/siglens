/**
 * `/developers`의 코드 예시 문자열. 화면에 보이는 글자가 곧 복사되는 명령이므로, 그대로 셸에 붙여 넣어 돌아가는지가
 * 이 모듈의 계약이다 — 여러 줄 명령은 마지막 줄을 뺀 모든 줄이 ` \`로 끝난다.
 *
 * 경로·환경 변수·헤더 이름은 공유 상수에서 읽는다(SKILL.md·OpenAPI 문서와 같은 값).
 */

import {
    API_KEY_ENV_NAME,
    API_KEY_PREFIX,
    LOCALE_HEADER_DOC_NAME,
    PUBLIC_API_DOC_PATHS,
} from '@/shared/config/publicApi';
import { SKILL_FILE_NAME } from './developersContent';

/** 셸 줄 이음. 다음 줄이 같은 명령으로 이어진다. */
const LINE_CONTINUATION = ' \\';

/** Skill을 내려받아 두는 Claude Code 경로. */
const SKILL_INSTALL_DIR = '~/.claude/skills/siglens';

/** 스트리밍 응답에서 실패(`error`)와 결과(`data`)를 가르는 jq 필터. */
const STREAMING_JQ_FILTER =
    "jq 'if .error then {failed: .error} else .data end'";

/** 키 원문 대신 보이는 자리표시. 접두만 실제 값이다. */
const KEY_PLACEHOLDER = `${API_KEY_PREFIX}…`;

/** 환경 변수에 키를 넣는 명령. */
export const ENV_EXPORT_COMMAND = `export ${API_KEY_ENV_NAME}=${KEY_PLACEHOLDER}`;

/** 인증 헤더 예시. */
export const AUTHORIZATION_HEADER_EXAMPLE = `Authorization: Bearer ${KEY_PLACEHOLDER}`;

/** 응답 언어를 고르는 헤더 예시. */
export const LOCALE_HEADER_EXAMPLE = `${LOCALE_HEADER_DOC_NAME}: en`;

/** 키 상태와 남은 한도를 확인하는 `GET /me` 호출. */
export function meCurlCommand(apiBase: string): string {
    return [
        `curl -s ${apiBase}/me${LINE_CONTINUATION}`,
        `  -H "Authorization: Bearer $${API_KEY_ENV_NAME}"`,
    ].join('\n');
}

/** Claude Code에 SKILL.md를 내려받아 두는 두 명령(폴더 만들기 → 내려받기). */
export function skillInstallCommand(apiBase: string): string {
    return [
        `mkdir -p ${SKILL_INSTALL_DIR}`,
        `curl -s ${apiBase}${PUBLIC_API_DOC_PATHS.skill}${LINE_CONTINUATION}`,
        `  -o ${SKILL_INSTALL_DIR}/${SKILL_FILE_NAME}`,
    ].join('\n');
}

/**
 * 새 분석 생성 호출 뒤에 jq를 파이프로 잇는 예시. 도구 curl 예시의 마지막 줄(`-d '…'`)에는 이음 표시가 없으므로
 * 여기서 붙인다 — 없으면 셸이 `| jq` 줄을 새 명령으로 읽어 문법 오류가 난다.
 */
export function streamingExampleCommand(toolCurl: string): string {
    return [
        `${toolCurl}${LINE_CONTINUATION}`,
        `  | ${STREAMING_JQ_FILTER}`,
    ].join('\n');
}
