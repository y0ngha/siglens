/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 공개 Open API 출시 플래그 — 기본값 꺼짐(OFF).
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 공개 API(`/api/v1/*` REST, API 키, Agent Skill, 개발자 포털 `/developers`)는 코드가 모두 들어 있지만
 * 아직 출시하지 않았다. 이 플래그 하나로 노출 면 전부를 가린다:
 *
 *     PUBLIC_API_ENABLED=true
 *
 *  - 꺼지면(기본):
 *    - `/developers`(모든 로케일)는 `notFound()`(404, noindex)이고 sitemap·푸터 링크에서 빠진다.
 *    - `/api/v1/*` 모든 라우트는 인증·한도·DB보다 먼저 404 `{ error: { code: 'not_found' } }`를 돌려준다
 *      (`withApiErrorBoundary`가 한 곳에서 검사한다).
 *    - `/account`의 "시그렌즈 API" 섹션(키 목록·발급·API 기본 모델·Skill)은 렌더되지 않고, 그 데이터 액션도
 *      호출하지 않는다. API 키·기본 모델 서버 액션은 직접 호출돼도 `not_available`로 거절한다.
 *  - 웹사이트 자체의 BYOK("AI 모델 API 키") 섹션과 ai.siglens.io 에이전트는 이 플래그와 무관하게 동작한다.
 *  - `true`/`1`/`on`/`yes`(대소문자 무관)만 켠다. 비우거나 그 밖의 값이면 꺼진 것이다.
 *
 * ── 어떤 면이 언제 값을 읽는가 ──────────────────────────────────────────────
 *  - 런타임 env를 즉시 따른다(요청마다 읽음): `/api/v1/*` 라우트(`force-dynamic`), `/account`, 서버 액션,
 *    동적으로 렌더되는 페이지의 Footer.
 *  - 빌드 시점 또는 ISR에 굳는다: `/developers`(ISR `revalidate = 86400`이라 하루 안에 재생성되며 그때의
 *    런타임 값을 읽는다), 정적으로 프리렌더된 페이지의 Footer, 정적 sitemap.
 *
 * 그래서 빌드와 런타임 값이 어긋나면 면마다 상태가 갈린다:
 *  - 빌드 OFF + 런타임 ON: API 라우트·계정 섹션·액션은 열리는데 정적 Footer 링크와 정적 sitemap에는 빠져 있다.
 *    `/developers`는 ISR 재생성 시점까지 404가 남다가 하루 안에 열린다.
 *  - 빌드 ON + 런타임 OFF(롤백): API 라우트·계정 섹션·액션은 즉시 닫히는데 정적 Footer 링크와 sitemap에는
 *    `/developers`가 남고, `/developers`도 ISR 재생성 전까지 캐시된 본문을 낸다. 링크는 있는데 닫힌 반쪽 상태다.
 *
 * 결론: 켤 때도, 되돌릴 때도 빌드 ARG와 런타임 env를 **같은 값으로 함께** 바꾸고 재배포한다. 런타임 env만
 * 바꾸는 것은 지원하는 절차가 아니다. 절차:
 *  1. `Dockerfile`에 `PUBLIC_API_ENABLED` ARG/ENV를 추가하고 CI 빌드에 같은 build-arg를 넘긴다
 *     (지금은 ARG가 없어 빌드가 항상 꺼짐으로 굳는다. 기본 꺼짐에는 영향이 없다).
 *  2. 운영 런타임 env(SSM/`--env-file`)와 CI build-arg를 같은 값(`true` 또는 비움)으로 맞춘다.
 *  3. 새 이미지를 빌드해 재배포한다(ISR 캐시가 남아 있으면 `/developers`가 하루 늦게 바뀔 수 있으니
 *     배포 뒤 `/developers`·sitemap·푸터를 확인한다).
 *  4. 켤 때만: 아래 README 섹션을 복원한다.
 *
 * README 복원: 출시 전 단계라 `README.md`·`README.ko.md`에서 공개 API 섹션("Open API and Agent Skill" /
 * "오픈 API와 에이전트 스킬": /developers·openapi.json·openapi.yaml·SKILL.md 링크와 `get_chart_data` 설명)을 뺐다.
 * 출시할 때 되살려야 한다 — 이 플래그를 도입한 커밋 이전의 `README.md` git 이력(`git log -p -- README.md`,
 * 그 커밋의 부모 리비전)에서 두 파일의 해당 섹션("## Supported markets" 바로 앞)을 복구한다.
 * 서버 env 전용이다(`NEXT_PUBLIC_*` 아님): 클라이언트 컴포넌트가 직접 읽지 말고 서버에서 결정을 내려 보낸다.
 */
export function isPublicApiEnabled(): boolean {
    const raw = process.env.PUBLIC_API_ENABLED?.trim().toLowerCase();
    if (raw === undefined) return false;
    return ['true', '1', 'on', 'yes'].includes(raw);
}
