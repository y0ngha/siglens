/**
 * 마지막으로 비콘을 보낸 `${KST 날짜}:${member|guest}`를 담는 키(브라우저 로컬 스토리지).
 * 서버로 전송되지 않는다. 개인정보처리방침 v15 §7이 이 키를 고지한다(가드 `visitHistoryPrivacy`).
 */
export const VISIT_MARKER_STORAGE_KEY = 'siglens:visit:v2';

/** 날짜만 담던 옛 마커 키. 더는 읽지 않고, 다음 전송에서 지운다(`VisitorPing`). */
export const LEGACY_VISIT_MARKER_STORAGE_KEY = 'siglens:visit';
