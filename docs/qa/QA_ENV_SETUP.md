# QA 환경 셋업 가이드 (범용)

> 어떤 기능이든 **prod처럼 빌드·실행**해 수동 검증(curl + 브라우저)하고 **실제 Redis/Postgres**까지
> 실증하기 위한 로컬 환경 셋업. 특정 기능 전용이 아니라 모든 QA에 재사용한다.
> E2E 자동화 하니스의 docker 백엔드 세부는 [E2E.md](./E2E.md)와 단일 소스로 공유한다(중복 금지).

---

## 1. Docker 백엔드 (Postgres + Redis + SRH)

`docker-compose.e2e.yml`이 3개 서비스를 띄운다. **Redis도 docker로 실제 구동**하므로 캐싱 동작을
prod Upstash 미접촉으로 실증할 수 있다.

| 서비스 | 이미지 | 포트 | 역할 |
|---|---|---|---|
| postgres | `postgres:17` | `5433:5432` | DB (Neon 대체) |
| redis | `redis:7` | `6380:6379` | 실제 Redis |
| serverless-redis-http (SRH) | `hiett/serverless-redis-http` | `8079:80` | **Upstash REST 호환 프록시** (`SRH_CONNECTION_STRING: redis://redis:6379`) |

```bash
yarn e2e:up          # docker compose -f docker-compose.e2e.yml up -d
# postgres/redis가 healthy 될 때까지 대기 (run-e2e.sh wait_for_backend_health 참고)
yarn e2e:down        # 종료 + 볼륨 삭제 (-v)
```

**Redis 실증 경로**: `.env.e2e`의 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` /
`UPSTASH_REDIS_REST_READONLY_TOKEN`이 SRH(`localhost:8079`)를 가리킨다. 앱의 Upstash 클라이언트
(`getOrSetCache`)가 prod Upstash 대신 **로컬 docker Redis**를 때리므로, FMP 입력 캐싱·공지 등
캐싱 동작을 실제로 확인할 수 있다(envelope `{data}`, TTL, graceful fallback 검증 가능).

---

## 2. `.env.local`의 DATABASE_URL 전환·원복

수동 검증에서 앱이 docker DB를 보게 하려면 `.env.local`의 `DATABASE_URL`을 docker로 바꾼다.

```
DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e
```

> ⚠️ **워크트리 `.env.local`과 메인 레포 `.env.local`은 별개 파일**이다. 워크트리에서 검증했다면
> 워크트리의 `.env.local`을 바꾸고, **끝나면 메인 레포 `.env.local`과 동일(Neon)하게 반드시 원복**한다.
> 원복은 `cp <메인레포>/.env.local <워크트리>/.env.local`이 가장 깔끔하다(검증용 추가 키도 함께 제거됨).

**Neon HTTP 드라이버 주의**: 기본 클라이언트는 Neon serverless(HTTP) 드라이버라 `localhost` Postgres에
연결되지 않는다. E2E 경로(`E2E_TEST=1`)는 `clientTest`(postgres-js TCP)로 우회한다 —
[E2E.md](./E2E.md)의 stubbing 구조 참조. 일반 prod 빌드로 docker DB를 보려면 `E2E_TEST=1`로 빌드하거나
TCP 드라이버 seam을 쓴다. (검증용 임시 seam을 코드에 추가했다면 **커밋 금지 + 끝나고 원복**.)

---

## 3. prod-like 빌드 / 실행

```bash
# 실제 production 빌드 (E2E 백엔드 env로 docker 연결)
E2E_TEST=1 yarn build
yarn start -p 4300        # prod 서버

# 빌드 exit code는 파이프로 가리지 말 것 (실패가 exit 0으로 숨는다)
E2E_TEST=1 yarn build > /tmp/build.log 2>&1; echo "EXIT=$?"
```

- `run-e2e.sh`의 `next_env_shadow_args`/`run_with_e2e_env`는 `.env.e2e`를 셸 env로 주입해
  prod 빌드가 docker 백엔드를 보게 한다(playwright `webServer.command`도 동일 패턴).
- 정적 prerender(예: `/privacy`, `/terms`)는 **빌드 타임에 DB를 실제로 읽는다**. docker가 떠 있어야
  빌드가 통과한다(아니면 ISR/SSG가 DB 연결 실패로 깨짐).

---

## 4. 멀티브라우저 도구

- **claude-in-chrome (MCP)** — **Chrome 전용**. Safari·모바일 엔진 검증 불가.
- **Playwright** — Safari(webkit)·모바일은 여기서. 자세한 매트릭스는 [MULTI_ENV_TESTING.md](./MULTI_ENV_TESTING.md).

```bash
yarn playwright install chromium webkit   # 최초 1회
```

---

## 5. 워크트리에서 검증할 때 주의 (node_modules)

- node_modules는 **symlink 금지** — Turbopack이 거부하고 dual-React로 `useEffect` null 다발 실패.
- `cp -al`(하드링크)로 복제하고 잔여 `node_modules/node_modules`를 제거한다.
- 검증용 stub(예: `node_modules/server-only`를 no-op으로 덮기)을 만들었다면 **끝나고 원복**
  (`cp <메인레포>/node_modules/server-only/index.js <워크트리>/...` 또는 `yarn install`).

---

## 6. prod DB 절대 미접촉

- `DIRECT_DATABASE_URL`이 **prod Neon**이면 `db:migrate`가 prod를 칠 수 있다. docker 검증 시
  `DIRECT_DATABASE_URL`을 docker URL로 **override**하고 마이그레이트한다.
- 사후 검증: prod Neon journal(`drizzle/meta/_journal.json` 또는 DB)에 당일 엔트리가 없으면 미변경.
- 읽기 전용 검증(예: 정적 페이지 prerender)은 Neon 연결 자체는 무방하나, **쓰기는 절대 docker로**.

---

## 7. 종료 체크리스트 (원복 필수)

검증이 끝나면 다음을 **반드시** 되돌린다(다음 빌드/CI가 깨지지 않도록):

- [ ] 워크트리 `.env.local` → 메인 레포와 동일(Neon)하게 원복, 검증용 추가 키 제거
- [ ] 코드에 넣은 검증용 seam(예: `client.ts`의 `DB_FORCE_TCP`) 원복 (커밋 금지)
- [ ] `node_modules` 검증 stub(server-only 등) 원복
- [ ] prod 서버 종료: `lsof -ti :4300` 확인 후 `pkill -9 -f "next-server"` / `pkill -9 -f "next start"`
- [ ] `yarn e2e:down` (docker 백엔드 + 볼륨 정리)
- [ ] 수동으로 시딩한 데이터(공지/유저 등) 삭제 — 공유 docker DB에 남으면 다음 E2E가 엉뚱한 데이터를 본다
      (실제로 잔존 시드가 기존 E2E를 마스킹해 실패시킨 사례 있음 → [EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md))
- [ ] (선택) 검증용 워크트리·Chrome 탭 정리

---

## 8. pre-push 게이트 (참고)

`.husky/pre-push`는 **format:check / lint / typecheck / test / build**를 돌린다. e2e는
`SIGLENS_RELEASE_E2E=1`일 때만 추가된다. 즉 일반 push는 build까지만 — docker 미기동 시 build의
DB 연결 단계에서 실패할 수 있으니 `.env.local`이 연결 가능한 DB(Neon)를 가리키는지 확인한다.
`--no-verify`는 **사용자 허락 없이 금지**(CI와 동일 게이트라 우회하면 CI에서 터진다).
