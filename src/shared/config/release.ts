/**
 * 캐시 키에 넣는 릴리스 식별자. 컨테이너 env `GIT_SHA`이고 값은 커밋 SHA가 아니라
 * 릴리스 버전(IMAGE_TAG)이다(`.github/workflows/deploy.yml` 빌드 단계, `Dockerfile`
 * runner 스테이지). 로컬·E2E처럼 없으면 빈 문자열이다.
 *
 * ISR 데이터 캐시(`fetch/`)는 배포를 넘어 공유된다(`cache-handler/config.mjs`
 * `DATA_CACHE_VERSION`). DB가 본문을 쥔 항목(약관·가이드)을 `unstable_cache`에 담을 때
 * 키에 릴리스를 넣으면, 본문을 고치고 배포한 새 릴리스에서 이 엔트리만 빌드 스코프로
 * 되돌아가 바로 다시 읽는다 — 비용은 배포마다 키 조합당 DB 조회 한 번이다.
 */
export const RELEASE_ID: string = process.env.GIT_SHA ?? '';
