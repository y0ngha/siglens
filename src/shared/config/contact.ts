export const CONTACT_TITLE_MAX_LENGTH = 120;
export const CONTACT_CONTENT_MAX_LENGTH = 2000;

/**
 * 문의·종목 요청 폼의 봇 함정(honeypot) 입력 이름. 사람에게는 보이지 않는 입력이라 값이
 * 있으면 자동 제출로 본다. 폼(숨김 입력)과 Server Action(판정)이 같은 이름을 써야 한다.
 *
 * `website`·`url` 같은 흔한 이름은 비밀번호 관리자·브라우저가 자동 채움해 실제 문의를 조용히
 * 버리게 하므로, 어떤 자동 채움 휴리스틱에도 걸리지 않는 이름을 쓴다.
 */
export const INQUIRY_HONEYPOT_FIELD = 'siglens_hp_ignore';
