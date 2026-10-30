/**
 * Investor Flows 데이터 수집 중 **SEC 클라이언트**(`shared/api/sec`)가 쓰는 상수. 13F 정책 상수는
 * `entities/investor-flows/lib/investorFlowsPolicy.ts`에 있다(shared는 entities를 import할 수 없다).
 */

/**
 * SEC EDGAR 공정 접근 정책이 요구하는 User-Agent(연락처 포함). 비어 있거나 일반 브라우저 UA면 403.
 * `SEC_USER_AGENT` env로 덮어쓸 수 있다.
 */
export const SEC_USER_AGENT_DEFAULT = 'SigLens dev.y0ngha@gmail.com';

/** EDGAR Archives 루트 — 클라이언트 요청 URL과 저장·표시용 원문 링크(`secFilingIndexUrl`)가 함께 쓴다. */
export const SEC_ARCHIVES_BASE_URL = 'https://www.sec.gov/Archives/edgar';

/**
 * SEC 요청 시작 사이의 최소 간격(ms). 공식 한도는 초당 10건이고 우리는 그 절반 아래(초당 ~4.5건)로 둔다.
 *
 * ── 불변식: SEC를 두드리는 배치 cron 합계가 이 속도를 넘지 않는다 ─────────────────────────────────
 * 이 게이트는 **프로세스 안** 모듈 변수라 인스턴스(ASG 최대 4대) 사이에는 공유되지 않는다. 그래서 인스턴스 간 합산은
 * **cron 락**이 지킨다 — 대량 SEC 요청을 내는 cron은 이름별 락이 아니라 **공유 락 `investor-flows:cron-lock:sec`** 하나를
 * 함께 잡는다(`sec-13f`·`sec-ftd`, `app/api/cron/leasedCron.ts`의 `leaseName`). 동시에 한 SEC cron만 돌므로 cron 합계는
 * 한 프로세스의 이 게이트(~4.5건/초)를 넘지 않는다.
 *  - Form 144·증자 공시(424B5) 추출은 별도 cron이 아니라 `sec-13f` 실행 **안에서** 13F 다음에 남은 시간으로 한다 — 같은
 *    daily index를 쓰고 같은 게이트·락 아래다.
 *  - `cusip-map`의 `company_tickers.json` 주간 갱신은 **주 1건**이라 공유 락 밖에 둔다(같은 프로세스 게이트는 지난다).
 *  - 렌더 경로의 submissions 조회(`fetchSubmissionsJson`)는 cron 예산 밖이다 — 같은 게이트를 지나되 슬롯 대기까지 포함한
 *    `SEC_SUBMISSIONS_BUDGET_MS` 안에 끝나지 못하면 degrade한다.
 * 새 SEC cron을 만들면 공유 락을 잡을 것. 이름별 락을 쓰면 두 인스턴스에서 동시에 돌아 합계가 두 배가 된다.
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

/**
 * 렌더 경로 `data.sec.gov/api/xbrl/companyconcept` 조회의 **전체** 예산. 실측(2026-10-24): 응답 2~4KB(분기 팩트 ≈100~350개 —
 * 큰 `companyfacts`와 달리 한 개념뿐). 넘으면 호출부가 degrade한다.
 */
export const SEC_COMPANY_CONCEPT_BUDGET_MS = 8_000;

/** information table 본문 크기 상한(바이트). 초대형 필러(수십만 행)도 이 안에 든다. */
export const SEC_MAX_INFO_TABLE_BYTES = 200 * 1024 * 1024;

/**
 * `www.sec.gov/files/...` 정적 파일·목록 페이지 본문 상한(바이트). 실측(2026-10-16): FTD 반월 zip ≈1.5MB, FTD 목록 페이지
 * ≈0.4MB, `company_tickers.json` ≈0.8MB — 여유를 크게 둔 값이다.
 */
export const SEC_MAX_FILE_BYTES = 16 * 1024 * 1024;

/**
 * 문서 머리 읽기(`fetchFilingDocumentHead`) 상한(바이트). 424B5 분류는 태그를 지운 앞 10,000자만 본다 — 실측 4건(2026-10-15
 * 제출)에서 그만큼의 본문 글자는 원문 앞 15~54KB 안에 있었다. 제출 `.txt` 앞의 SEC 헤더(수 KB)를 더해도 남는 값이다.
 */
export const SEC_FILING_HEAD_MAX_BYTES = 256 * 1024;
