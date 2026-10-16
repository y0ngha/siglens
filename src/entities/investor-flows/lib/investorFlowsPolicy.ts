/**
 * Investor Flows(기관·내부자·공매도 수급) 수집·집계 **정책 상수** — 슬라이스 소유.
 * 설계: `docs/superpowers/specs/2026-10-15-investor-flows-design.md`.
 * SEC 클라이언트 타임아웃·속도 상수는 `shared/config/investorFlows.ts`(shared 클라이언트가 쓴다).
 */

/**
 * daily index 백필 범위(일). 보존이 "완결 2분기 + 진행 분기"라 가장 오래된 보존 분기(현재 2026-03-31)의
 * 제출(4~5월)부터 닿으면 되므로 ~200일이다. 더 거슬러 가도 그 앞 분기 포지션은 보존 하한 때문에 버려진다.
 */
export const INVESTOR_FLOWS_13F_BACKFILL_DAYS = 200;

/**
 * 13F 제출 마감 = 분기말 + 45일. 이 날(그리고 주말·휴일 이월분을 위한 여유 `GRACE`일)이 지나면
 * 해당 분기는 "완결"로 본다.
 */
export const INVESTOR_FLOWS_13F_FILING_DEADLINE_DAYS = 45;
export const INVESTOR_FLOWS_13F_COMPLETE_GRACE_DAYS = 5;

/** 보존: aggregates는 이 개월 수보다 오래된 분기를 지운다(설계: 8분기 이상). */
export const INVESTOR_FLOWS_AGGREGATE_RETENTION_MONTHS = 36;
/** 보존: short_interest 2년, short_volume 롤링 120일. */
export const INVESTOR_FLOWS_SHORT_INTEREST_RETENTION_DAYS = 730;
export const INVESTOR_FLOWS_SHORT_VOLUME_RETENTION_DAYS = 120;

/** 실패한 13F accession을 다시 시도하는 최대 횟수. 넘으면 영구 실패로 두고 더 시도하지 않는다. */
export const INVESTOR_FLOWS_13F_MAX_ATTEMPTS = 3;

/** 한 번의 DB INSERT에 담는 최대 행 수(바인드 파라미터 한도·페이로드 한도를 한참 밑돈다). */
export const INVESTOR_FLOWS_UPSERT_CHUNK_SIZE = 500;

/** 유니버스로 인정하는 미국 거래소(FMP `exchange`). 한국·크립토·OTC는 제외한다. */
export const INVESTOR_FLOWS_US_EXCHANGES: readonly string[] = [
    'NASDAQ',
    'NYSE',
    'AMEX',
];

/**
 * 직전 분기를 "비교 기준"으로 쓰려면 그 분기에 반영된 13F 필러가 최소 이만큼은 있어야 한다. 13F 필러는
 * 분기마다 5천~1만 곳이라, 수집 범위 밖에서 정정으로만 들어온 몇 곳이나 백필이 덜 끝난 분기를 기준으로
 * 삼으면 모든 보유자가 "신규"로 잡히는 거짓 변화가 나온다(2026-10 로컬 실측: 직전 분기 4곳 기준으로
 * 이번 분기 471곳이 전부 신규). 이 값 미만이면 변화 열은 NULL이다.
 */
export const INVESTOR_FLOWS_BASELINE_MIN_FILERS = 1_000;

/** 보존 정리: 한 번에 지우는 행 수(ctid 배치) — 수백만 행을 한 문장으로 지우면 락·WAL·메모리가 폭주한다. */
export const INVESTOR_FLOWS_PRUNE_BATCH_SIZE = 50_000;
/** 한 실행에서 정리·집계 flush에 쓰는 시간 상한(ms). 남은 일은 다음 실행(durable)이 이어 간다. */
export const INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS = 120_000;

/** `positions.value_k`(천 달러, int4) 상한 — 초과 시 클램프(포지션 하나 $2.1T). */
export const INVESTOR_FLOWS_VALUE_K_MAX = 2_147_483_647;

/** 한 실행이 `revalidateTag`로 무효화하는 심볼 수 상한(나머지는 12h 캐시 만료에 맡긴다). */
export const INVESTOR_FLOWS_REVALIDATE_CAP = 500;

/** cusip-map cron이 실행당 FMP로 다시 대조하는 기존 매핑 수(작은 배치 — 전수 재처리 금지). */
export const INVESTOR_FLOWS_CUSIP_RECHECK_BATCH = 100;

/** 영구 실패(시도 소진) accession이 이 수를 넘으면 backlog 경고 로그를 남긴다. */
export const INVESTOR_FLOWS_FAILED_BACKLOG_ALERT = 50;

/**
 * 유지보수(집계 flush·정리) 한 덩어리(청크·배치 한 번)가 걸릴 수 있는 최악의 시간(ms) — 시간 상자는 청크 **사이**에서만
 * 확인되므로 마지막 청크가 이만큼 더 걸릴 수 있다고 본다(`sec-13f/route.ts`의 CC-7 합계에 들어간다).
 * 실측(로컬 Postgres 17, 포지션 810만 행 = 운영 3분기 규모): 500 CUSIP 재계산 ≈ 2.1초(완결·패널), 기준 없음 ≈ 0.7초
 * (다음 분기까지 하면 청크 하나 ≈ 5초), 분기 전체 dirty 표시 ≈ 0.9초, 270만 행 정리(54배치) ≈ 5.7초. 운영 `db.t4g.small`은 더
 * 느릴 수 있어 6배 여유를 둔 값이다.
 */
export const INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS = 30_000;

/** 교체(RESTATEMENT)와 함께 다시 얹는 나중 NEW HOLDINGS 정정의 최대 개수 — 넘으면 그 제출은 실패로 두고 재시도한다. */
export const INVESTOR_FLOWS_MAX_REAPPLY = 5;

/**
 * `investor_flows_state` 키 — cusip-map이 **전수 한 바퀴**(후보 0건)를 끝냈을 때 한 번 기록하고 **다시 지우지 않는다**.
 * sec-13f는 이 키가 없으면 수집하지 않는다(`universe_incomplete`): 유니버스가 덜 찬 채로 제출을 "처리됨"으로 표시하면
 * 나중에 매핑된 CUSIP은 그 제출의 포지션을 영영 못 얻는다. 한 번 서고 나면 신규 상장·CUSIP 변경으로 후보가 다시 생겨도
 * 게이트는 닫히지 않는다(그 뒤의 늦은 매핑은 `baseline` 규칙이 NULL로 처리하고 복구는 `investor-flows:reingest-13f`).
 */
export const INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE =
    'cusip_map_full_pass_done';

/**
 * `investor_flows_state` 키 — sec-13f가 초기 백필 창(최근 `INVESTOR_FLOWS_13F_BACKFILL_DAYS`일)을 **끝까지** 읽어 오늘에
 * 닿았을 때 한 번 기록하고 **다시 지우지 않는다**(set-once). 화면은 이 표식(+ `INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE`)이
 * 서기 전까지 13F 구간에 "데이터 없음" 대신 "수집 중" 안내를 낸다 — 백필이 끝나기 전의 빈 구간은 "이 종목에 데이터가
 * 없다"가 아니라 "아직 못 모았다"이기 때문이다.
 */
export const INVESTOR_FLOWS_STATE_BACKFILL_DONE = 'sec13f_backfill_done';

/**
 * 전수 한 바퀴 완료로 인정하려면 맵에 최소 이만큼은 있어야 한다 — 티커 DB가 비어 있어 후보가 0건인 상태를 "완료"로
 * 오인하지 않는 안전장치다(미국 보통주 중 CUSIP이 확인되는 종목은 수천 개).
 */
export const INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED = 1_000;

/**
 * 한 심볼이 인프라 오류(FMP 402·400·5xx, OpenFIGI 장애)로 **연속** 이만큼 실패하면 `persistentError` miss를 건다. cusip-map은
 * 하루 한 번이라 3일 연속 — 일시 장애는 그 안에 풀리고, 영구 오류는 후보 목록을 영영 막지 않는다(막으면 전수 한 바퀴 표식이
 * 서지 못해 sec-13f가 `universe_incomplete`에 갇힌다).
 */
export const INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD = 3;

/**
 * 전면 장애 판정 — 한 실행에서 시도가 이만큼 이상이고 그중 `RATIO` 이상이 실패했으면 심볼 고유의 문제가 아니라 FMP/OpenFIGI가
 * 통째로 죽은 것이다. 그런 실행의 실패는 **세지 않는다**(수동으로 연달아 돌리는 부트스트랩 중 잠깐의 전면 장애가 수천 심볼을
 * miss로 만들어 매핑이 안 된 채 sec-13f 게이트가 열리는 것을 막는다). 시도가 `MIN_ATTEMPTS`보다 적으면(소수 심볼의 실패)
 * 판정하지 않고 센다.
 */
export const INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS = 20;
export const INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO = 0.9;
