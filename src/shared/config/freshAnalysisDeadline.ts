import { TOOL_TIMEOUT_MS } from '@y0ngha/siglens-core';

/**
 * 이 값만 따로 둔 이유: `publicApi.ts`는 널리 import돼서 거기서 코어 값을 읽으면 코어를 부분 목하는 테스트가
 * 모듈 로드 때 깨진다. 이 파일은 마감을 말하는 문서·예시 쪽만 import한다.
 */
/**
 * `run_fresh_analysis`(새 분석 생성)의 마감(초). 코어가 `expensive` 비용 등급 도구에 주는 마감
 * (`TOOL_TIMEOUT_MS.expensive`)이고 `executePublicTool`이 그 값으로 요청을 닫는다 — 넘기면 `tool_timeout`이다.
 * 문서의 "마감 N초"와 curl `--max-time`이 이 값 하나를 읽는다. 실측(2026-10 라이브 스모크)은 48.6~58.6초였다.
 */
export const FRESH_ANALYSIS_DEADLINE_SECONDS = TOOL_TIMEOUT_MS.expensive / 1000;
