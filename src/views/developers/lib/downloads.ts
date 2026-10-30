/**
 * 내려받기 섹션의 파일 목록과 파일 이름 규칙. 목록 순서가 화면 카드 순서다.
 */

import { PUBLIC_API_DOC_PATHS } from '@/shared/config/publicApi';
import type { DeveloperDocPath } from '../types';
import { SKILL_FILE_NAME } from './developersContent';

/** 화면에 보이는 카드 순서: OpenAPI JSON → YAML → SKILL.md. */
export const DEVELOPER_DOWNLOAD_PATHS: readonly DeveloperDocPath[] = [
    PUBLIC_API_DOC_PATHS.openapiJson,
    PUBLIC_API_DOC_PATHS.openapiYaml,
    PUBLIC_API_DOC_PATHS.skill,
];

/** `/openapi.json` → `openapi.json`. 확장자가 없는 Skill 경로만 `SKILL.md`로 받는다. */
export function downloadFileName(path: DeveloperDocPath): string {
    return path === PUBLIC_API_DOC_PATHS.skill
        ? SKILL_FILE_NAME
        : path.replace(/^\//, '');
}
