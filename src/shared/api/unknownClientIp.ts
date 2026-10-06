/**
 * 클라이언트 IP를 알 수 없을 때 쓰는 값. {@link import('./getClientIp').getClientIp}가
 * 헤더가 없으면 돌려주고, IP별 한도(분석 생성 한도의 IP 정규화, `/api/client-error`의
 * 보고 상한)는 이 값을 하나의 공용 버킷으로 다룬다.
 *
 * `getClientIp.ts`는 `server-only`라 순수 모듈(`normalizeQuotaIp`)이 거기서 import하지
 * 못한다 — 그래서 상수만 의존 없는 이웃 파일로 둔다.
 */
export const UNKNOWN_CLIENT_IP = 'unknown';
