# AGENTS.md

When working on this project, read and follow the instructions in `CLAUDE.md` located in this same directory.

The CLAUDE.md file contains critical guidelines, constraints, and operational procedures that must be followed for all code changes and implementations.

**ALWAYS READ CLAUDE.md FIRST before taking any action.**

## Memory

> 전역(cross-project) 습관/워크플로우는 `~/.codex/AGENTS.md`에 있음. 아래는 siglens 프로젝트 전용 항목.

### User

- **인증은 옵션, 회원 혜택은 tier로만**: 비회원도 모든 기본 기능을 사용할 수 있다. 회원가입은 옵션이며 보호 라우트는 없다(`proxy.ts`는 로그인된 사용자의 역방향 가드만 수행).

### Feedback

- **E2E는 FMP 키 없음 전제로 설계**: `e2e.yml`에 `FMP_API_KEY`를 주입하지 않는다. unseeded 심볼의 degrade→noindex 동작을 symbol-seo/resilience 테스트가 검증(ground truth=no-FMP). analysis fixture는 `submitAnalysisAction`의 `isE2E` 단락이라 FMP와 무관.
- **deep-tree 등록 훅 렌더 폭풍 주의**: Context 등록 훅 effect deps에 ctx value/객체(result)를 넣으면 무한 재등록 폭풍이 생긴다. 픽스=안정 primitive deps + 객체는 ref 캡처 + 안정 register 의존.
- **`yarn clear:build`로 Next 캐시 정리**: `rm -rf .next/` 직접 실행 금지. `package.json`의 `clear:build` 스크립트를 사용.
- **core=도메인만, 데이터 fetch는 전부 siglens**: 외부세계 연결(fetch)은 siglens 책임, `siglens-core`는 순수 도메인 로직만 가진다.
- **재사용 로직은 siglens-core로 분리**: 모든 consumer가 똑같이 짜는 helper는 siglens 앱이 아니라 core 이슈로 분리해 코어 머지 후 import. Next.js 전용 로직은 예외.
- **QA env 스왑 후 `.env.local`/`.env.production` 복원 확인 필수**: prod-like 빌드용으로 백업 후 복원이 세션을 넘기며 누락되기 쉽다(gitignore라 `git status`에 안 보임). 형제 워크트리와 키셋 비교로 완전성 검증.
- **iOS Safari fixed 오버플로우 디버깅 순서**: fixed 요소 수정 전에 document 너비를 넓히는 원소부터 찾을 것.
- **siglens-core 배포는 사용자→Claude 위임(2026-06-21~)**: PR approve→main 병합→`yarn release`(release-it, v* 태그)→siglens package.json dep bump+install+검증까지 Claude가 수행. APPROVED 전 머지·배포 금지.
- **PR 리뷰 봇 false-positive 사례**: force-static 단일이미지, revalidate 리터럴 등 이 레포 리뷰 봇의 반복 오탐 패턴.

### Project

- **ISR cacheHandler 외부화 완료(v0.31.1)**: 디스크풀 근본해결. Next 16.2 cacheHandler로 S3 외부화(키=GIT_SHA prefix), DynamoDB는 의도적 제외. fail-open 알람/kill-switch 런북 적용. 첫 배포 시 `12-isr-cache.sh`+`00-iam-setup.sh` 선행 필수, `printenv`로 컨테이너 env 확인.
- **디스크풀→FS read-only 인시던트(2026-06-28)**: golden AMI가 minimal 이미지라 SSM agent 부재(수정 완료, `PINNED_AMI` 갱신). 근본원인은 ISR/fetch 캐시 디스크 누적 → cacheHandler 외부화로 해결, EBS도 50GB 증설.
- **홈/economy 빈 ISR 캐시 인시던트(PR #657)**: FMP 402가 재검증 중 uncaught throw로 0-byte 캐시 동결. 방지=전 로더 catch→degrade+root/global error.tsx.
- **빌드타임 ISR env는 3곳 모두 필요**: `/economy`·`/market` 빌드타임 prerender용 FMP_API_KEY는 Dockerfile secret mount + deploy.yml `--secret` + GH Actions secret 3곳 모두 설정해야 한다.
- **Vercel→AWS 마이그레이션 완료(2026-06-24/25)**: siglens.io는 AWS ALB+ASG(t4g.medium arm64)에서 서빙, Vercel 프로젝트는 삭제됨. AI 분석은 외부 WORKER로 오프로드.
- **Cloudflare 인프라 + WAF**: siglens.io는 CF 프록시 뒤(cf-connecting-ip). WAF는 proxied(orange-cloud)일 때만 작동. HTML Cache Rule(RSC-aware)로 엣지 캐싱 활성.
- **ISR revalidate 페이지별 차등화(PR #572)**: 홈/재무/공시 24h·overall/options/news 12h·차트 6h·market만 1h. cron 미도입(전수 재검증 시 Fast Origin 폭증).
- **ISR 비용·SEO 최적화 R2(PR #591/#593)**: 롱테일 sitemap 라우트 통합, robots AI봇 하이브리드, 캐시키 pageSize 임베드.
- **model-gate 빈 test.skip 2개는 의도된 placeholder**: 유료 티어 게이팅 미작동 상태라 둔 것. 감사 시 재플래그/제거 금지.
- **CI E2E env 누수 → 해결(#558)**: `pool:vmThreads`가 워커 내 파일 간 `process.env` 공유 → `unstubEnvs:true`+전역 afterAll 복원으로 수정.
- **CI/E2E 경로 게이팅(PR #642)**: PR 변경이 전부 무관하면 무거운 잡 스킵(dorny 필터). `ci-required`·`e2e-required`가 master ruleset의 required status check.
- **시간 의존 flaky 테스트 2곳**: `CachedMarketDataProvider`(ET 세션 TTL)와 `fmpMarketNewsClient`(7일 lookback 경계)가 실제 시각 미mock으로 간헐 실패. `vi.setSystemTime` 등으로 결정화 필요.
- **pre-push e2e 단축은 회귀 없이는 불가**: 병렬화/incremental build/distDir 분리 전부 회귀 유발로 원복됨. 근본해결은 워커별 독립 서버+DB뿐.
- **siglens-core 릴리스 방법**: npm 공개 아니라 GitHub Packages(npm.pkg.github.com). `publish.yml`은 `v*` 태그 push 트리거이며 main 머지만으론 publish 안 됨.
- **Vercel 비용 실측 분해**: Fast Origin Transfer·ISR Writes·Observability가 주요 비용. Fast Data Transfer는 CF 캐싱으로 거의 $0.
- **지표 IndicatorResult 전송 낭비(백로그)**: 클라 실사용은 12개 지표뿐인데 30개 전송. 정답은 레지스트리 화이트리스트로 클라 직렬화 경계에서 trim.

### Reference

- **보조지표 시그널 레퍼런스**: `refs/indicators/new/`에 13종 보조지표 시그널 정보 정리.
- **투자 이론 레퍼런스**: `refs/theory/`에 엘리어트 파동이론·이동평균선 투자법 정리.
- **PR 토글 스크립트**: `scripts/pr_toggle_ready.sh`로 Draft→Ready 토글(GraphQL 대신 사용).
- **프롬프트 변경 시 PROMPT_TEMPLATE_VERSION bump**: core 분석 캐시 키가 `PROMPT_TEMPLATE_VERSION`+skill catalog 해시. 프롬프트 텍스트만 바꾸면 즉시 반영 안 됨(TTL까지 self-healing) — 즉시 반영하려면 core version bump+재릴리스.
- **새 심볼 탭 추가 표준 레시피**: core port+siglens adapter+캐시 데코, 2계층 단일 TTL, AI 잡(submit/poll+normalize), SEO/ISR, chat buildChatState, overall 스코어카드, 룰점수 detectSignals 패턴, 90% 테스트 커버리지. 예시: `docs/superpowers/specs/2026-06-15-symbol-financials-tab-design.md`.
