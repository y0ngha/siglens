# `/about` 소개·방법론 페이지 — 설계 (2026-09-11)

`docs/architecture/SEO_RECOVERY_2026_09.md` §5-B1. 2026-07 core update 강등의 프로필이
"운영 주체·방법론 없는 AI 생성 금융(YMYL) 사이트"라, 색인 코퍼스 축소(A)와 함께 가는 신뢰 신호다.
단독 효과는 작다 — 이 페이지가 순위를 올리는 게 아니라, 재평가 때 불리한 프로필 하나를 지운다.

## 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 렌더 | `LegalPageShell` + `PolicyMarkdownBody` 재사용, 새 UI 없음 | terms/privacy와 같은 정적 문서 페이지. 디자인 작업은 SEO 이득 0 |
| 본문 저장 | 코드 상수(`content.ts`), ko·en 마크다운 | DB(약관 방식)는 법률 검토용 인프라라 과함. 본문은 배포와 함께 바뀌는 게 맞다 |
| ja·zh | ko 본문 + `UntranslatedNotice` | 약관과 같은 폴백 규약. 색인은 ko만(`STATIC_INDEXABLE_LOCALES`) |
| 운영 주체 | 실명 **신용하**, `dev.y0ngha@gmail.com`, `github.com/y0ngha/siglens`(공개) | 사용자 결정 2026-09-11. `siglens-core`는 private라 "지표 계산 공개"는 쓰지 않는다 |
| ISR | `revalidate = 86400` | 약관과 동일. 본문이 코드라 배포가 곧 갱신 |
| JSON-LD | `AboutPage`(WebPage 헬퍼 + `@type` 덮어쓰기) + `Person`(신용하, sameAs GitHub) · BreadcrumbList | 홈 `Organization#organization`에 `founder` → Person 연결 |

## 본문 구성 (ko, h2 7개 — `extractToc`가 목차로 씀)

1. **Siglens는 무엇인가** — 티커 하나로 차트·펀더멘털·재무·뉴스·옵션·의회 거래·공포탐욕을 AI가 종합. 매매 기능 없음.
2. **누가 만들고 운영하나** — 개인 개발자 신용하. 이메일·GitHub. 회사·광고주·증권사 제휴 없음.
3. **분석은 어떻게 만들어지나** — 시세(Yahoo Finance·FMP·Polygon, 한국 종목 마스터는 공공데이터포털) → 보조지표 39종·캔들 패턴 49종·전략 스킬 60+ 계산 → LLM(OpenAI·Anthropic·DeepSeek) 서술 → 스키마 검증·정규화. 시세 최대 15분 지연.
4. **얼마나 자주 갱신되나** — 검색·공유용 스냅샷은 매일 미국 장마감 후 재생성, 로그인 사용자는 온디맨드 재분석.
5. **한계** — AI 서술은 사실 오류·수치 오독 가능, 과거 데이터 기반, 실시간 아님, 개인 상황 미반영.
6. **면책** — `investmentDisclaimer` 문구 + 매수·매도 권유 아님 + 약관 링크.
7. **문의** — 이메일 + 푸터 문의하기.

## 배선

- `src/shared/lib/legal.ts`: `ABOUT_PATH`, `aboutTitle/aboutFullTitle/aboutDescription` (`shared.seo.about.*`).
- `messages/{ko,en,ja,zh}.json`: `shared.seo.about.{title,description}`, `shared.lib.legal.aboutIntro`. 두 네임스페이스 모두 `manualKeys.preserve`라 extract가 지우지 않는다.
- `src/proxy.ts` `RESERVED_FIRST_SEGMENTS`에 `'about'` — 없으면 `/about`이 `/ABOUT` 티커로 301된다(`proxy.test.ts`가 디렉터리 목록과 대조해 강제).
- `buildStaticEntries`: `/about` yearly·0.4 (legal 0.3보다 한 단계 위 — 사이트 전체의 신뢰 앵커).
- `Footer`: 개인정보처리방침 앞에 링크. `prefetch={false}`(전역 푸터 `_rsc` 파편화 규약).
- 홈 `Organization`에 `founder: { '@type': 'Person', name, url: /about, sameAs }`.

## 테스트

- `about/__tests__/page.test.ts`: title/robots(ko index)/canonical/OG article/twitter summary — terms 테스트 미러 + JSON-LD가 `AboutPage`·`Person`을 내는지.
- `buildStaticEntries.test.ts`: `/about` 포함, legal 3건.
- `proxy.test.ts`: 자동(디렉터리 스캔).

## 하지 않는 것

저자 페이지 분리, 사진, 경력 서술, 리뷰/후기, 팀 소개. YAGNI.
