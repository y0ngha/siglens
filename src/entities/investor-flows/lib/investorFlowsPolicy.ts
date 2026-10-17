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
 * `investor_flows_state` 키 — FINRA 공매도 **1회 재수집** 요청. cusip-map이 전수 한 바퀴 표식을 처음 세울 때 함께 남기고, finra-short가
 * 창 안의 이미 저장된 파일(일별 거래량 창 전체, 잔고 1년치)을 최근 것부터 실행당 상한 안에서 다시 읽어 전체 유니버스로 채운 뒤
 * 지운다. finra-short는 수집 시점의 유니버스 심볼만 저장하므로, 유니버스가 차기 전에 읽은 파일에는 나중에 매핑된 심볼의 행이
 * 없다. 값은 진행 커서(JSON, `lib/finraRebackfill.ts`)다.
 */
export const INVESTOR_FLOWS_STATE_FINRA_REBACKFILL = 'finra_rebackfill_pending';

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

// ── 수급 확장(SEC FTD·Form 144·증자 공시·Reg SHO) ─────────────────────────────────────────────────────

/**
 * Form 144·증자 공시 daily index 백필 범위(일). core의 희석 축이 최근 180일 공시를 보고, 내부자 축의 Form 144 신호(30일 군집)는
 * 그 안에 든다 — 그보다 오래된 공시는 신호에 쓰이지 않는다.
 */
export const INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS = 180;
/** Form 144·424B5 문서 실패를 다시 시도하는 최대 횟수. 넘으면 영구 실패로 두고 그 accession은 더 받지 않는다. */
export const INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS = 3;
/**
 * Form 144·증자 공시 수집이 "따라잡았다"고 보는 커서 지연(일). 커서(`sec_filings_cursor`)는 백필 시작일(180일 전)부터 앞으로
 * 나아가므로, 오늘에서 이 일수 안에 들어오기 전에는 최근 공시가 비어 있을 수 있다 — 수급 탭이 그 빈 구간을 "공시 없음" 대신
 * "수집 중"으로 말하는 기준이다. 7일은 주말·연휴에 cron 한두 번이 비어도 다시 "수집 중"으로 돌아가지 않게 둔 여유다.
 */
export const INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS = 7;
/** 보존: Form 144 1년, 증자 공시 2년. 재시도 큐는 Form 144 보존과 같은 1년이 지나면 지운다. */
export const INVESTOR_FLOWS_FORM144_RETENTION_DAYS = 365;
export const INVESTOR_FLOWS_OFFERING_RETENTION_DAYS = 730;

/** 보존: FTD 2년. 처음 비어 있을 때는 최근 24개 반월 파일(1년)을 백필하고, 실행당 최대 4개 파일을 받는다. */
export const INVESTOR_FLOWS_FTD_RETENTION_DAYS = 730;
export const INVESTOR_FLOWS_FTD_BACKFILL_FILES = 24;
export const INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN = 4;
/**
 * 저장하지 못한 FTD 파일(trailer 불일치·깨진 zip·링크 대상 없음)을 다시 받는 최대 횟수. 실패한 파일은 건강한 파일 **뒤에** 줄 서고
 * 이 횟수를 넘기면 더 받지 않는다 — 영구히 깨진 최신 파일이 실행당 상한(4개)을 차지해 옛 파일 백필을 굶기지 않게 한다.
 */
export const INVESTOR_FLOWS_FTD_MAX_ATTEMPTS = 3;

/** 보존: Reg SHO 과열 목록 180일. 비어 있으면 최근 60일(달력)을 백필한다 — 13 결제일 연속 규칙을 보기에 충분하다. */
export const INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS = 180;
export const INVESTOR_FLOWS_REG_SHO_BACKFILL_DAYS = 60;

/** `company_tickers.json` → `sec_cik_symbol_map` 갱신 주기(일). cusip-map cron(매일)이 이 간격이 지났을 때만 받는다. */
export const INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS = 7;
/**
 * `sec_cik_symbol_map` 교체를 받아들이는 최소 쌍 수 — 형식이 바뀌었거나 유니버스가 비어 쌍이 거의 없는 결과로 맵을 통째로
 * 비우지 않는 안전장치다(미국 보통주 유니버스는 수천 종목, `INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED`와 같은 규모).
 */
export const INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS = 1_000;

/** `investor_flows_state` 키 — Form 144·증자 공시 daily index 커서(마지막으로 끝까지 처리한 날짜 `YYYY-MM-DD`). */
export const INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR = 'sec_filings_cursor';
/** `investor_flows_state` 키 — Reg SHO 과열 목록 커서(시장별 마지막 처리 거래일, JSON 객체). */
export const INVESTOR_FLOWS_STATE_REG_SHO_CURSOR = 'reg_sho_cursor';
/** `investor_flows_state` 키 — `sec_cik_symbol_map`을 마지막으로 갱신한 날(`YYYY-MM-DD`, UTC). */
export const INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED = 'sec_cik_map_synced_on';

// ── 한국 DART 지분공시(설계 §4) ───────────────────────────────────────────────────────────────────────

/** 보존: 대량보유·임원 소유보고·거래계획보고서 2년. 회사 이력을 통째로 받아도 이보다 오래된 행은 저장하지 않는다. */
export const INVESTOR_FLOWS_DART_RETENTION_DAYS = 730;

/**
 * `dart-filings` 실행당 DART 호출 상한(목록 페이지 + 회사별 2건). 한국 유니버스 ≈2,700사 × 2건 ≈ 5,400건의 최초 백필은
 * 하루 2회 실행으로 ≈2일에 끝나고, 하루 합계(최대 3,000건)는 일일 한도 2만 건(`DART_DAILY_QUOTA`)의 15%다.
 */
export const INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN = 1_500;

/**
 * 공시검색(`list.json`)을 거슬러 볼 수 있는 최대 일수 — 고유번호 없이 검색하면 기간이 3개월로 제한된다(개발가이드 2019001).
 * 커서가 이보다 오래됐으면(장기 중단) 이 창으로 자른다 — 그 앞의 변동은 회사별 전체 이력 재조회(백필)가 이미 담는다.
 */
export const INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS = 89;

/**
 * 커서가 없을 때(첫 실행) 공시검색 시작일 — 대량보유·소유보고(D001·D002)는 최근 7일만 본다(그 앞 이력은 백필이 회사별로
 * 받는다). 거래계획보고서(D005)는 목록 행만이 원천이라 검색 가능한 최대 창(`INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS`)을 본다.
 */
export const INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS = 7;

/** 상세 유형 하나의 공시검색 페이지 상한(페이지당 100건) — 형식이 바뀌어 `total_page`가 터무니없을 때의 안전장치. */
export const INVESTOR_FLOWS_DART_MAX_LIST_PAGES = 50;

/** 회사 재조회가 일시 오류로 실패한 횟수 상한 — 넘으면 대기열에서 뺀다(다음 공시가 다시 넣는다, SERVER.md#CC-11). */
export const INVESTOR_FLOWS_DART_MAX_ATTEMPTS = 3;

/** 진행 상태를 이 회사 수마다 저장한다 — 실행이 도중에 죽어도 그만큼만 다시 받는다(멱등 upsert). */
export const INVESTOR_FLOWS_DART_STATE_FLUSH_EVERY = 25;

/**
 * `corpCode.xml` 반영을 받아들이는 최소 상장사 행 수 — 유가·코스닥·코넥스 상장사는 ≈2,700곳이다. 형식이 바뀌어 행이 거의
 * 없는 결과로 맵을 덮지 않게 한다.
 */
export const INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS = 2_000;

/** `investor_flows_state` 키 — 공시검색 커서와 재조회 대기열(JSON, `dartIngestState.ts`). */
export const INVESTOR_FLOWS_STATE_DART_LIST_CURSOR = 'dart_list_cursor';
/** `investor_flows_state` 키 — 최초 백필 진행(마지막으로 받은 고유번호, JSON). */
export const INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR = 'dart_backfill_cursor';
/**
 * `investor_flows_state` 키 — 최초 백필이 유니버스 끝까지 닿았을 때 한 번 기록하고 다시 지우지 않는다(set-once). KR 수급 탭의
 * "수집 중" 안내가 이 표식을 본다(준비 상태 `dart` 갈래, 설계 §4.5 — 13F 백필 표식 `INVESTOR_FLOWS_STATE_BACKFILL_DONE`과 같은 역할).
 */
export const INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE = 'dart_backfill_done';
