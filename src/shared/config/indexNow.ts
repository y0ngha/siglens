import { SITE_URL } from '@/shared/lib/seo';

/**
 * IndexNow 소유 증명 키.
 *
 * 비밀이 아니다. IndexNow는 "이 키가 `keyLocation`에서 공개로 읽힌다"는 사실로
 * 호스트 소유를 확인하므로 `public/{key}.txt`로 그대로 서빙한다. 이 상수와 그
 * 파일의 내용이 어긋나면 제출이 전부 403으로 거절되므로 테스트가 둘의 일치를 강제한다
 * (`__tests__/indexNow.test.ts`).
 */
export const INDEXNOW_KEY = '53164b8c3c6561d29dc713efbb1ae43e';

export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

/**
 * 제출 엔드포인트 — **한 곳**이다.
 *
 * `api.indexnow.org`에 보낸 제출은 IndexNow 참여 검색엔진(Bing, Naver, Yandex, Seznam
 * 등)이 서로 공유한다. 네이버(`searchadvisor.naver.com`)도 참여 엔진 목록에 있으므로
 * 네이버 엔드포인트로 같은 목록을 또 보내면 중복 제출일 뿐이고 429(속도 제한) 위험만
 * 는다(2026-10-04 indexnow.org 문서·`searchengines.json`로 확인). Google은 IndexNow에
 * 참여하지 않는다 — Google은 sitemap `lastmod`로 재방문을 정한다.
 *
 * 응답 상태: 200·202(키 검증 대기)는 성공, 403은 키 없음·불일치, 422는 URL 호스트 불일치,
 * 429는 속도 제한이다. 실패 로그에 상태를 싣는 이유가 이 구분이다.
 */
export const INDEXNOW_ENDPOINTS = [
    'https://api.indexnow.org/indexnow',
] as const;

/**
 * 요청 대기 상한. 이 제출은 프리웜 크론의 부가 임무라 락을 오래
 * 붙들면 안 된다 — 청크가 여럿이어도 신호 하나를 공유하므로 전체 지연이 이 값을 넘지 않는다.
 */
export const INDEXNOW_TIMEOUT_MS = 5_000;

/** IndexNow 프로토콜이 요청 하나에 허용하는 `urlList` 상한. */
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;
