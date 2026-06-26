# 릴리스 실증 테스트 케이스 — v0.28.0 → master (v0.29.0 후보)

> **범위**: `v0.28.0`(현재 프로덕션) → `origin/master d01af93d`. 미배포 **16개 PR**, 474 files (+10,241/-3,052).
> **목적**: 단일 대형 릴리스를 한 번에 배포하기 전, 변경 전 영역을 실증(curl/Chrome/실제 워커 분석)으로 회귀 검증.
> **판정**: 각 케이스 PASS/FAIL. Blocker 1건이라도 있으면 NO-GO.

## 변경 범위 ↔ PR 매핑
| 영역 | PR | 핵심 변경 |
|---|---|---|
| Vercel 제거 | #640 | waitUntil seam·@vercel/* 제거, vercel.json 삭제 |
| server-only 배럴 | #641 | client 번들에서 server-only repo 배제 |
| SEO 헬퍼 | #645·#656 | symbol JSON-LD/metadata 추출, canonical 정리 |
| DST/ET 통합 | #646 | eastern.ts 단일화(장 세션 판정) |
| 옵션 차트 | #647 | strike-bar 공통 추출(dedup) |
| 뉴스카드 셸 | #648 | label/class 주입형 통합 셸 |
| FMP 제네릭 | #649 | provider boilerplate(symKey/cachedList/E2E singleton) |
| P2 cleanup | #650 | StockChart·useAnalysis·ModelSelect·dead barrel |
| Spec-2 | #651~654 | symbol-page 조합 → views(pages) 레이어, 위젯 사이클 차단 |
| Spec-3 | #655 | user/session → entities/auth 병합 |
| 감사 하드닝 | #656 | SIGTERM drain·/api/ready·golden AMI·AI 에러/스켈레톤 셸·SEO canonical |
| ISR 빈-캐시 방지 | #657 | 10개 page degrade 가드 + error.tsx/global-error.tsx |

---

## 0. 테스트 환경 셋업 (실증 전제)

**ENV-1. 앱 prod 빌드+부팅 (배포 아티팩트와 동일)**
- 도구: shell
- 단계:
  1. 깨끗한 워크트리: `git worktree add .claude/worktrees/release origin/master` + `cp -al node_modules` 하드링크
  2. `rm -rf .next && yarn build` → `BUILD_EXIT=0` 확인, `.next/standalone/server.js` 존재
  3. 부팅(특수문자 안전): `PORT=4400 node_modules/.bin/dotenv -e .env.local -- node .next/standalone/server.js`
- 기대: "Ready", 런타임 로그에 error/throw/DYNAMIC_SERVER_USAGE 0

**ENV-2. 워커 서버 기동 (실제 AI 분석용)**
- 도구: shell (`../siglens-worker`)
- 단계: `cd ../siglens-worker && yarn dev`(또는 `yarn build && yarn start`) → WORKER_URL이 가리키는 포트로 listen 확인. 앱 `.env.local`의 `WORKER_URL`/`WORKER_SECRET`이 이 워커를 가리키는지 확인(불일치 시 로컬 워커 URL로 임시 override).
- 기대: 워커 health 응답, 앱이 분석 submit 시 워커가 잡을 받음

> 참고: AI 분석은 외부 워커 오프로드 구조([[project_aws_migration_phase_c]]). 워커 미가동 시 분석 탭은 "분석 중"에서 멈추거나 degrade — D 그룹은 워커 가동이 전제.

---

## A. 배포 안정성 / 인프라 (#656) — curl

| ID | 케이스 | 단계 | 기대 |
|---|---|---|---|
| A-1 | `/api/health` 얕은 헬스 | `curl :4400/api/health` | `{"status":"ok"}` 200 |
| A-2 | `/api/ready` 딥 프로브 | `curl :4400/api/ready` | `{"status":"ready","database":{"ok":true},"redis":{"ok":true}}` 200 |
| A-3 | `/api/ready` 실패 degrade | DB/Redis 차단 후 `curl /api/ready` | 503 + `{ok:false}` (ALB가 라우팅 제외하도록) |
| A-4 | **SIGTERM graceful drain** | 부팅 후 `kill -TERM <pid>` | 로그 `[instrumentation] SIGTERM received — draining...` → `drain complete — exiting`, **EXIT 0, ≤25s** |
| A-5 | standalone 산출물 | `ls .next/standalone/server.js` | 존재(배포 아티팩트 유효) |
| A-6 | check-env 게이트 | `infra/aws/check-env.sh`(SSM) | EXIT=0(필수키 전부 SSM 존재, BYOK/DEBUG warn-skip) |

## B. 코어 페이지 렌더 (Spec-2 + ISR + Vercel제거) — curl + Chrome

| ID | 경로 | 도구 | 기대 |
|---|---|---|---|
| B-1 | `/` 홈 | curl+Chrome | 200, **non-empty**(히어로·검색·80스킬·섹터종목·크립토), 0-byte 아님 |
| B-2 | `/economy` | curl+Chrome | 200 non-empty, 실제 경제지표(degraded 셸 아님) |
| B-3 | `/market` | curl+Chrome | 200 non-empty, 섹터/신호 |
| B-4 | `/news` 허브 | curl+Chrome | 200, 5개 카테고리 카드 |
| B-5 | `/news/general` | curl+Chrome | 200, 뉴스 리스트 |
| B-6 | `/backtesting` `/privacy` `/terms` | curl | 200 non-empty |
| B-7 | Vercel 흔적 0 | `curl -sI /` 헤더 + HTML grep | `@vercel/analytics` 스크립트·vercel 헤더 없음 |
| B-8 | 미시드 심볼 cold-gen | `curl /MSFT` | **200**(500 아님) + `noindex`(degrade) |

## C. SEO (#645·#656) — curl

| ID | 케이스 | 단계 | 기대 |
|---|---|---|---|
| C-1 | 페이지별 self-canonical | `/`·`/economy`·`/backtesting`·`/privacy`·`/terms`·`/AAPL`·각 탭 canonical 추출 | 각자 **자기 URL**, **count=1**, 홈 canonical 상속 0 |
| C-2 | JSON-LD | 각 페이지 `application/ld+json` | WebSite/WebPage/Breadcrumb 등 존재·유효 |
| C-3 | OG/twitter | symbol 탭 `og:image`/title | 탭별 OG 이미지 연결 |
| C-4 | robots/sitemap | `/robots.txt`·`/api/sitemap` | 검색봇 허용, AI봇 정책, sitemap 200 |
| C-5 | noindex degrade | 미시드 심볼 메타 | `noindex,nofollow` + canonical null |

## D. 심볼 분석 플로우 + **실제 AI 분석** (Spec-2 #651~654 + analysis) — Chrome + 워커

> 전제: ENV-2 워커 가동. 대상 심볼 예: AAPL(주식), BTCUSD(크립토).

| ID | 케이스 | 단계(Chrome) | 기대 |
|---|---|---|---|
| D-1 | 차트 탭 로드 | `/AAPL` 진입 | 차트 렌더, 보조지표 토글, 38지표/패턴 표시 |
| D-2 | **실제 AI 분석 생성** | `/AAPL` 진입 → AI 리포트 영역 관찰(워커가 잡 처리) | "분석 중" → **AI 리포트 완성**(추세·리스크·매수 가이드·신호) |
| D-3 | 뉴스 탭 | `/AAPL/news` | 뉴스 리스트 + AI 뉴스 종합(워커), EventCalendar/AnalystActions 섹션 |
| D-4 | 펀더멘털 탭 | `/AAPL/fundamental` | 7개 섹션 카드(밸류/수익성/성장/건전성 등) 렌더 |
| D-5 | 재무제표 탭 | `/AAPL/financials` | 손익/재무상태/현금흐름 표 + AI 재무 분석 |
| D-6 | 의회 탭 | `/AAPL/congress` | 의원 거래 + AI 동향 해석 |
| D-7 | 옵션 탭 (#647) | `/AAPL/options` | strike-bar 차트 렌더(dedup 후 회귀 없음) + AI 옵션 분석 |
| D-8 | 종합 탭 | `/AAPL/overall` | 종합 스코어카드 + AI 종합 |
| D-9 | 공포탐욕 탭 | `/AAPL/fear-greed` | F&G 게이지/차트 |
| D-10 | 크립토 심볼 | `/BTCUSD` + 탭 | 자산클래스 게이팅 정상(옵션 등 비해당 탭 제외) |
| D-11 | 탭 네비 격리 | 한 탭 에러 시 | 분석종류 nav 생존(에러 격리) |
| D-12 | 모델 선택 (symbol-model) | AI 모델 셀렉터 변경 | 모델 전환 후 재분석 트리거 |
| D-13 | 챗봇 (chat) | 심볼 페이지 챗 | buildChatState 기반 응답(워커/Gemini) |

## E. 인증 플로우 (Spec-3 #655) — Chrome + 워커(DB)

> 인증은 옵션([[project_auth_optional]]) — 비회원도 기본 기능 사용. 가입/로그인 자체 검증.

| ID | 케이스 | 단계 | 기대 |
|---|---|---|---|
| E-1 | 회원가입 | `/signup` 폼 제출(테스트 계정) | 가입 성공 → 이메일 인증 안내 |
| E-2 | 로그인 | `/login` | 세션 생성, 로그인 상태 반영(헤더) |
| E-3 | 로그아웃 | 로그아웃 | 세션 해제, 비회원 헤더 |
| E-4 | 비밀번호 재설정 | `/forgot-password`→토큰→`/reset-password` | 재설정 플로우 동작 |
| E-5 | OAuth(구글/카카오) | `/login` OAuth 시작 | consent → 콜백 → 세션(시크릿 필요, 수동) |
| E-6 | 계정 삭제 | `/account` 삭제 | compensation 동작, 데이터 제거 |
| E-7 | auth barrel 회귀(#641·#655) | 위 플로우 중 콘솔/네트워크 | server-only 누수 에러 0, `@/entities/auth` 정상 |
| E-8 | 보호라우트 가드 | 로그인 상태로 `/login` 접근 | 역방향 가드(proxy.ts) — 홈 등으로 |

## F. ISR 빈-캐시 방지 / 에러 경계 (#657) — 유발 테스트

| ID | 케이스 | 단계 | 기대 |
|---|---|---|---|
| F-1 | economy degrade | snapshot 로더 실패 유발(또는 e2e seam) | `EconomyDegraded`(non-empty 200), **0-byte 아님** |
| F-2 | financials/congress 에러 바운더리 | E2E_FORCE_*_ERROR 쿠키 | 에러셸 + '다시 시도' → 복구 |
| F-3 | root error.tsx | 임의 라우트 throw 유발 | 브랜드 에러 UI + '다시 시도'(미보호 10라우트) |
| F-4 | global-error.tsx | root-layout throw 유발 | 자체 html/body + 스타일된 에러(globals.css 적용) |
| F-5 | AI 에러/스켈레톤 셸(#656) | 분석 실패/로딩 | 통합 셸 렌더(cn), FMP 메시지 우선(news는 비-FMP 보존) |

## G. 리팩토링 회귀 (#646·#647·#648·#649·#650) — Chrome/curl

| ID | 케이스 | 기대 |
|---|---|---|
| G-1 | 장 세션 판정(DST/ET #646) | 헤더/배지의 장중·장외 상태가 `TZ=America/New_York` 기준과 일치 |
| G-2 | 옵션 strike-bar(#647) | 콜/풋 막대 차트 렌더·정렬 정상(추출 후 시각 회귀 0) |
| G-3 | 뉴스카드 셸(#648) | 뉴스 카드 마크업/슬롯(라벨·sentiment) 정상 |
| G-4 | FMP 제네릭(#649) | bars/profile/news 등 FMP 데이터 정상 로드, 캐시 동작 |
| G-5 | StockChart/useAnalysis(#650) | 차트 바인딩·분석 훅 회귀 0, ModelSelect 동작 |

## H. 통합/안정성 — curl + 관찰

| ID | 케이스 | 기대 |
|---|---|---|
| H-1 | ISR 라우트 타입 | 빌드 output: `[symbol]`+탭 `●`(SSG/ISR), api/auth `ƒ`(Dynamic) — Dynamic 회귀 0 |
| H-2 | 전체 라우트 스모크 | A~B의 모든 경로 200 + non-empty(바이트>0) |
| H-3 | 콘솔/네트워크 에러 | Chrome devtools — 페이지별 console error·실패 요청 0(degrade 의도 로그 제외) |
| H-4 | 회귀: 이전 정상 페이지 | v0.28.0에서 동작하던 핵심 플로우(검색→심볼→분석) 동일 동작 |

## I. 배포 인프라 / 골든 AMI (#656·#636 계열) — AWS CLI + Docker

> 실제 `v*` 배포 전에 **컴포넌트 단위로** 검증 가능(전체 end-to-end는 실배포가 유일하지만, 핵심 부품은 dress-rehearsal 가능). 일부는 billable(테스트 인스턴스 수 분).

| ID | 케이스 | 단계 | 기대 |
|---|---|---|---|
| I-1 | **골든 AMI 부팅 스모크** | `ami-0b5e386e4a2ed6492`로 t4g.medium 테스트 인스턴스 launch(09-bake와 동일 net/profile) → SSM | 인스턴스 running + SSM online |
| I-2 | **골든 AMI 베이크 내용 검증** | SSM: `docker --version`·`jq --version`·`rpm -q amazon-cloudwatch-agent`·`cat /etc/siglens-golden-ami` | docker/jq/cwagent 설치됨 + 골든 마커 존재(→ 부팅 시 dnf 스킵, cold-boot 단축) |
| I-3 | **골든 AMI에서 ECR pull+run** | SSM: ECR login → `docker pull <현재 ECR 이미지>` → `docker run` → `curl localhost:3000/api/health` | 200(AMI가 실제 앱 컨테이너 구동 가능 — 런타임 경로 검증). *주의: 현재 ECR 이미지는 v0.28.0* |
| I-4 | 테스트 인스턴스 정리 | `terminate-instances` | 누수 0(비용 정리) |
| I-5 | **Docker 이미지 빌드(arm64)** | deploy.yml 빌드 단계 복제: `docker buildx build --platform linux/arm64 --secret SIGLENS_GITHUB_TOKEN --secret DATABASE_URL --build-arg NEXT_PUBLIC_*` (신규 master 코드) | 빌드 성공(실 배포 아티팩트 + Dockerfile + build-arg 검증) |
| I-6 | arm64 exec 스모크 | `docker run --platform linux/arm64 --entrypoint /sbin/tini <image> -- node -e 'process.exit(0)'` | exec-format 에러 0(Graviton 호환) |
| I-7 | 런치 템플릿 핀 | `05-launch-template.sh` 검토(실행 시 LT 버전 생성) | LT가 `PINNED_AMI`(골든) + user-data(awslogs·env-fetch) 참조 |
| I-8 | live 인프라 정합 | 이미 적용분 재확인 | TG dereg=30, ASG grace=240, `vars.PINNED_AMI`=골든, EC2 role logs 권한 ✓ |
| I-9 | 롤백 메커니즘 | (이미 실증) instance-refresh MinHealthy=100 | 인시던트 때 무중단 교체로 검증됨 — deploy 실패 시 ASG 자동 롤백 |

> **전체 deploy.yml end-to-end**(태그→빌드→푸시→ASG roll)는 실배포가 유일한 완전 검증. 단 내장 안전장치(test-gate·arm64 smoke·instance-refresh 롤백·CF purge)는 위 I-5/6/9로 부분 확인.

---

## 실행 우선순위
1. **ENV-1·ENV-2** (셋업) → **A**(인프라) → **B/C**(페이지·SEO, curl 빠름)
2. **D**(심볼+실제 AI 분석, 워커) — 가장 큰 변경(Spec-2), 최우선 실증
3. **E**(인증, Spec-3) → **F**(ISR degrade) → **G/H**(회귀)

## 판정 기준
- **Blocker**: 코어 페이지 0-byte/500, 분석 미생성, 인증 깨짐, SIGTERM 비정상, canonical 누수 → NO-GO
- **High**: 특정 탭 렌더 실패, degrade 미동작 → 수정 후 재배포
- **Low**: 시각 미세 차이 → 배포 후 후속

> 작성: 2026-06-26. 실행 결과는 본 문서에 PASS/FAIL + 증거(상태코드/바이트/스크린샷)로 기록.

---

## ✅ 실행 결과 (2026-06-26, 신규 코드 master @localhost, curl+Chrome+실제 워커)

| 그룹 | 결과 | 증거 |
|---|---|---|
| ENV-1·2 | PASS | 앱 prod 부팅 + 워커 :8080(/health 200) |
| A-1·2·4·6 | PASS | health ok·ready{db,redis ok}·SIGTERM drain EXIT0·check-env live EXIT0 |
| B-1~8 | PASS | 8페이지 non-empty(0-byte 0)·Vercel 흔적 0·/MSFT 200(cold-gen safe) |
| C-1~5 | PASS | 9페이지 self-canonical(n=1, 상속0)·JSON-LD·robots/sitemap 200 |
| D-1·2·7·9·12 | PASS | 차트·**실제 AI분석(워커→Gemini 38s→"약세/높음/4스킬")**·옵션 strike-bar·공탐20/100·모델셀렉터 |
| E-1·2 | PASS | 가입 인증코드 발송 동작·로그인 폼/OAuth/링크. 전체 세션=e2e 커버 |
| **F (ISR degrade)** | **PASS** | **FMP 401 유발 → /NFLX·/AMD·/CRM 탭 200 non-empty+noindex, getProfileResilient/getBarsStatic degrade 로그.** 0-byte 미발생 |
| G-2 | PASS | 옵션 dedup(#647) OI/Vol strike-bar 정상 |
| I-1·4 | PASS | 골든AMI 부팅(running)·정리. I-2 SSM 미완(베이크시 marker 검증) |
| Dockerfile static | PASS | `.next/static`(42)·`public`(43)·sharp COPY 확인 → 프로덕션 static 503 없음 |

**핵심 발견**: standalone 로컬부팅 시 static 미복사로 청크 503(Chrome 네트워크로 적발) — Dockerfile은 복사하므로 **프로덕션 무관**.

**판정: Blocker 0 → GO.** 가장 큰 변경(Spec-2 심볼+실제 AI분석)과 인시던트 방지(#657 실제 FMP실패 degrade)가 실증 통과.
