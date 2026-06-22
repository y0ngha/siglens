# 릴리스(버전범위) 실증 검증 플레이북

> 최근 배포 ~ 현재 버전 사이의 변경사항과 핵심 기능을 **prod처럼 빌드·실행**해 동작/SEO 문제를
> 실증한다. E2E·테스트코드가 커버해도, prod 빌드 런타임 관점에서 curl + 브라우저로 직접 확인한다.

---

## 1. 목적 & 범위

- 범위: `vX.Y.Z`(직전 배포) ~ 현재 HEAD의 변경사항 + 핵심 기능.
- 관점: "실제 Production처럼 빌드/실행했을 때 동작에 문제가 없는지 / SEO에 문제가 없는지."
- E2E/단위가 잡지 못하는 **prod 빌드 산물·정적 prerender·메타데이터·캐시 헤더**를 본다.

---

## 2. 절차

1. **Spec 작성** — 변경 범위를 정리(무엇이 바뀌었나, 핵심 기능은 무엇인가).
2. **Test Case 생성(먼저)** — Opus 4.8로 케이스를 먼저 만든다([TEST_SHEET_AUTHORING.md](./TEST_SHEET_AUTHORING.md)).
   curl 케이스(C#)와 브라우저 케이스(B#)로 나눈다.
3. **환경 기동** — 개발/ prod 서버를 띄운다([QA_ENV_SETUP.md](./QA_ENV_SETUP.md)). DB가 필요하면 docker.
4. **이중 검증 실행**
   - **① curl** — 응답 본문/Status Code/헤더(`x-vercel-cache`, `Content-Type`, canonical/OG 메타 등).
   - **② 브라우저(Chrome 도구 + 필요 시 Playwright)** — 실제 렌더/상호작용/콘솔 에러.
   - 두 방법을 **모두** 활용한다.
5. **결과 요약** — 케이스별 PASS/FAIL + 실측 근거. 추측 금지([EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md)).
6. **수정 PR** — 발견 이슈는 수정 PR로([PR_REVIEW_LOOP.md](./PR_REVIEW_LOOP.md)).

SEO 항목(메타/canonical/OG/구조화데이터/H1)은 `seo-audit` 스킬을 병행한다.

세션 산출물 예시: `../superpowers/specs/2026-06-03-predeploy-verification.md`,
`../superpowers/specs/2026-06-04-v015-to-current-verification-spec.md`.

---

## 3. 재사용 프롬프트 템플릿

`{시작버전}`을 직전 배포 태그로 치환해 사용한다.

```
진행 전, 변경 범위에 대해 Spec을 작성하고, Test Case를 먼저 Opus 4.8로 생성해줘. 그 이후 실증을 진행할거야.

범위는 {시작버전} ~ 현재버전까지이고, 변경사항들과 핵심 기능들에 대해 문제가 없는지 Test case를 따라 테스트를 진행할거야.
E2E와 Test Code가 커버를 하고 있지만, 실제 Production처럼 빌드를 하고, 실행하였을 때 동작에 문제가 없는지 / SEO에 문제가 없는지 등 살펴보는거지.

두 가지 방안으로 할 수 있는데, 우선 개발서버를 띄우고
1. Curl로 확인한다. (응답값 / Status Code 등)
2. 크롬 도구를 이용해 직접 확인한다.
두 가지 방법을 모두 활용하여 진행해줘.
```

---

## 3-B. 크립토 기능 배포 시 추가 절차

크립토 탭(차트/뉴스/공포 탐욕/종합), 사이드바 CryptoShowcase, `/api/sitemap/crypto`를 포함하는
릴리스에는 DB 마이그레이션 + 시드가 필요하다. **배포 전 또는 배포와 동시에** prod DB에 적용한다.

```bash
# 1. 마이그레이션 — crypto_assets 테이블 생성 (중복 실행 무해, 이미 있으면 no-op)
yarn db:migrate

# 2. 시드 — FMP cryptocurrency-list 엔드포인트에서 종목 목록을 받아 crypto_assets 에 삽입
#    FMP 요금제에 cryptocurrency-list가 포함된 플랜(Starter 이상)이어야 한다.
#    FMP_API_KEY 환경 변수가 설정되어 있어야 함.
yarn db:seed:crypto
```

### 시드 후 검증 (curl)

```bash
# /BTCUSD 차트 페이지 → 200 (crypto_assets에 BTCUSD 행이 있어야 함)
curl -o /dev/null -s -w "%{http_code}" https://siglens.io/BTCUSD

# 크립토 사이트맵 → 200 + XML (popular 엔트리 + longtail 행 포함)
curl -s -o /dev/null -w "%{http_code}" https://siglens.io/sitemap-crypto.xml
```

**주의:** 시드 없이 배포하면 CryptoShowcase가 노출하는 링크(`/BTCUSD`, `/ETHUSD` 등)가
`getAssetInfo` DB 미스 → notFound()로 404가 되고, `/api/sitemap/crypto`는
longtail 행 없이 popular 엔트리만 포함된다(popular 엔트리는 DB 없이 정적으로 생성되므로
200은 유지되지만 longtail은 비어 있다).

---

## 4. 주의

- 빌드 exit code는 파이프로 가리지 말 것(`> log 2>&1; echo $?`).
- 정적 prerender는 빌드 타임에 DB를 실제로 읽는다 — docker 기동 필수.
- **prod DB 절대 미접촉**(쓰기는 docker로만). 검증 후 `.env.local`·검증 seam·시드 데이터 **원복**.
- 안정성 관점 교차검증은 [STABILITY_AUDIT.md](./STABILITY_AUDIT.md)와 병행하면 좋다.
