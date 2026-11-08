import { AGENT_TURN_CAPS } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';

/** 서버가 저장하는 `snapshot`의 UTF-8 상한. 초과분은 `capSnapshot`이 긴 문자열부터 절단한다. */
export const SNAPSHOT_MAX_BYTES = 256 * 1024;

/** `page_path` 상한(문자). 쿼리·해시는 먼저 제거한다. */
export const PAGE_PATH_MAX_LENGTH = 512;

/** 문자열 컨텍스트 필드(티커·모델 id 등) 상한. */
export const CONTEXT_STRING_MAX_LENGTH = 64;

/**
 * 챗 스냅샷의 대화 줄 수 상한. 넘으면 거부하지 않고 가장 최근 줄만 남긴다 - 평가한 마지막
 * 답변이 대화 끝에 있고, 긴 대화라고 평가를 버리면 안 된다.
 */
export const TRANSCRIPT_MAX_ENTRIES = 200;

/**
 * assistant 한 턴이 기록하는 도구 수 상한. 에이전트 한 턴이 부를 수 있는 도구 수(core
 * `AGENT_TURN_CAPS.maxToolCalls`)와 맞춰, 정상 턴이 상한에 걸리지 않게 한다. 넘으면 앞에서부터 남긴다.
 */
export const TRANSCRIPT_MAX_TOOLS = AGENT_TURN_CAPS.maxToolCalls;

/** 일일 요약 메일에 싣는 👎 항목 상한. */
export const DIGEST_MAX_DOWNS = 50;

/**
 * 피드백 보관 기간. 처리방침의 "수집일로부터 1년 후 자동 삭제"와 같은 값이며,
 * `/api/cron/feedback-digest`가 이 기간이 지난 행을 지운다. 바꾸면 처리방침도 함께 바꾼다.
 */
export const FEEDBACK_RETENTION_DAYS = 365;
export const FEEDBACK_RETENTION_MS = FEEDBACK_RETENTION_DAYS * MS_PER_DAY;
