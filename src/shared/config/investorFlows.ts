/**
 * Investor Flows 데이터 수집 중 **SEC 클라이언트**(`shared/api/sec`)가 쓰는 상수. 13F 정책 상수는
 * `entities/investor-flows/lib/investorFlowsPolicy.ts`에 있다(shared는 entities를 import할 수 없다).
 * 설계: `docs/superpowers/specs/2026-10-15-investor-flows-design.md`.
 */

/**
 * SEC EDGAR 공정 접근 정책이 요구하는 User-Agent(연락처 포함). 비어 있거나 일반 브라우저 UA면 403.
 * `SEC_USER_AGENT` env로 덮어쓸 수 있다.
 */
export const SEC_USER_AGENT_DEFAULT = 'SigLens dev.y0ngha@gmail.com';

/**
 * SEC 요청 시작 사이의 최소 간격(ms). 공식 한도는 초당 10건이고 우리는 그 절반 아래(초당 ~4.5건)로
 * 둔다. 프로세스 전역 하나의 게이트를 모든 SEC 호출이 공유한다 — cron 락이 동시에 한 실행만
 * 허용하므로 인스턴스 간 합산도 이 값을 넘지 않는다.
 */
export const SEC_MIN_REQUEST_INTERVAL_MS = 220;

/**
 * SEC 요청 시간 예산 — 문서 종류별로 **무엇을 얼마 동안** 기다리는지가 다르다(예산 합계는 `sec-13f/route.ts`).
 *
 *  - 작은 문서(index.json·primary_doc.xml·submissions): 요청 전체(헤더 + 본문)에 `SEC_REQUEST_TIMEOUT_MS`.
 *  - information table(최대 200MB): **헤더까지만** `SEC_HEADER_TIMEOUT_MS`. 본문 전체에 고정 타임아웃을 걸면
 *    큰 필러가 수신 중 끊겨 영구 실패(3회)로 굳고 집계가 틀어진다. 본문은 (1) 청크 사이 무소식
 *    `SEC_BODY_IDLE_TIMEOUT_MS` 정체 타임아웃과 (2) 전체 `SEC_INFO_TABLE_BODY_BUDGET_MS` 상한으로 지킨다 —
 *    느려도 바이트가 오가면 끝까지 받고, 멈추면 끊는다.
 */
export const SEC_REQUEST_TIMEOUT_MS = 30_000;
export const SEC_HEADER_TIMEOUT_MS = 20_000;
export const SEC_BODY_IDLE_TIMEOUT_MS = 30_000;
/** 200MB를 ~0.8MB/s 이상으로 받으면 통과하는 상한(실측 SEC→AWS는 수 MB/s 이상). */
export const SEC_INFO_TABLE_BODY_BUDGET_MS = 240_000;

/**
 * 일시 오류(5xx·네트워크) 재시도: 1회만, 백오프 대기 15초 이내(시도 타임아웃에 더해), `Retry-After`는 10초로 자른다. **429는
 * 재시도하지 않는다**(차단 신호 — 두드릴수록 차단이 길어진다).
 */
export const SEC_MAX_RETRIES = 1;
export const SEC_RETRY_BACKOFF_BUDGET_MS = 15_000;
export const SEC_RETRY_AFTER_CAP_MS = 10_000;

/** 렌더 경로 submissions 조회의 **전체**(슬롯 대기 + 요청 + 본문) 예산. 넘으면 URL 추정으로 degrade. */
export const SEC_SUBMISSIONS_BUDGET_MS = 8_000;

/** information table 본문 크기 상한(바이트). 초대형 필러(수십만 행)도 이 안에 든다. */
export const SEC_MAX_INFO_TABLE_BYTES = 200 * 1024 * 1024;
