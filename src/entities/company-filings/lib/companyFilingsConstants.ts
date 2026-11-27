/*
 * `get_company_filings`의 출력 계약 숫자. 도구 설명(`features/agent-tools/spec/getCompanyFilings.ts`)이 이 값을 그대로
 * 말하므로 설명의 "최근 120일"이 실제로 덮는 기간과 같다. 원래 core가 내보내던 값(같은 이름·같은 값)이고, 도구
 * 문구가 siglens로 옮겨 오면서 SEC 데이터를 가진 이 엔티티로 왔다.
 */

/** 목록 호출이 돌려주는 최대 공시 수(최신순). */
export const AGENT_FILINGS_LIST_MAX = 10;

/** 목록 호출이 거슬러 보는 기간(일). */
export const AGENT_FILINGS_WINDOW_DAYS = 120;

/** 본문 읽기 한 번이 돌려주는 최대 문자 수. 넘으면 `truncated`가 붙는다. */
export const AGENT_FILING_TEXT_MAX_CHARS = 12_000;
