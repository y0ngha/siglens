# ai.siglens.io/about 분리 설계

작성일: 2026-09-19. 프로토타입(아티팩트 "SIGLENS AI 소개" v6)을 사용자가 승인했고, 구현 판단은 위임받았다.

## 목표

- ai.siglens.io 첫 화면(`/`)은 대화 시작에 집중한다. 지금 그 아래 붙어 있는 소개 섹션(`AiLanding`: 출처, 로그인 비교, FAQ, 더 보기 링크)을 걷어낸다.
- 소개는 새 페이지 `ai.siglens.io/about`이 맡는다. 방문자가 "무엇을 물어볼 수 있고, 왜 다른 AI보다 믿을 만한지"를 1분 안에 이해하고 대화를 시작하게 만드는 게 이 페이지의 일이다.

## 범위 밖

- 종목 페이지 챗봇을 ai.siglens.io로 유도하는 작업(사용자 메모, 별도 과제).
- 예시 대화를 실제 대화 기록으로 바꾸는 작업. 이번에는 "예시 대화예요. 수치는 실제와 다를 수 있어요." 표기와 함께 고정 예시를 쓴다.

## 페이지 구성 (`/about`)

1. **상단 CTA 바**: 사이트 헤더 바로 아래에 붙는 고정 바. "궁금한 종목, 지금 물어보세요"와 프라이머리 "물어보기 →" 버튼이 들어간다.
   - 사이트 헤더는 이미 `sticky top-0 h-14`이고, ai 호스트 모바일에서는 아래로 스크롤하면 숨는다(`useHideOnScrollDown`). 바도 같은 훅을 써서 헤더가 숨을 때는 `top-0`, 보일 때는 `top-14`에 선다.
2. **히어로**: h1 "궁금한 종목, 지금 물어보세요". 보조 문구는 "SIGLENS AI가 최신 시세와 차트, 뉴스를 직접 찾아보고, 전문적으로 분석해서 쉬운 말로 알려드려요." 그 아래 "SIGLENS AI에게 물어보기" 버튼.
3. **대화 재생**: 입력창 없는 대화 카드. 흐름은 이렇다.
   - 질문이 말풍선 안에 타이핑된다(글자당 약 38ms, ±40% 흔들림).
   - 조회 칩이 하나씩 켜지고, 다 끝나면 한 줄 요약으로 접힌다.
   - 답변이 스트리밍되고, 끝에 출처와 기준 시각이 붙는다.
   - 시나리오 5개가 무작위로 돌고, 같은 것이 연달아 나오지 않는다.
   - 페이지에 들어오자마자 타이핑을 시작한다.
   - 일시정지 버튼이 있다(WCAG 2.2.2). 화면 밖으로 나가면 멈춘다.
   - `prefers-reduced-motion`이면 완성된 대화 한 장을 보여준다.
   - 카드 높이는 고정이다(데스크탑 420px, 모바일 520px). 가장 긴 답변이 들어가는 것을 확인한 값이다.
4. **이런 점이 답답했다면**: 불편했던 점과 SIGLENS AI의 해결을 짝지은 5줄.
5. **답하기 전에 이런 걸 찾아봐요**: 질문 말풍선 → 화살표 → 데이터 칸 8개 → 화살표 → 답변 말풍선. 칸마다 아이콘, 설명, 범위를 넣는다. 데스크탑 2열, 모바일 1열.
6. **자주 묻는 질문**: 8개를 `<details>` 아코디언으로 둔다. 같은 배열로 FAQPage JSON-LD도 만든다.
7. **마지막 CTA**와 면책 문구.

문구는 프로토타입 v6 그대로 쓴다. 해요체로, 긴 줄표 없이, 과장어 없이 쓴다. 매매 권유는 하지 않는다. 한국 주식 시세 지연은 쓰지 않는다(사용자 결정).

## 루트(`/`) 변경

- `EmptyState`에서 `<AiLanding>`을 빼고 `AiLanding.tsx`는 지운다. `widgets.agent-chat.Landing.*` 키는 추출 과정에서 고아가 되어 정리된다.
- 예시 질문 카드 아래에 `/about`으로 가는 링크 한 줄을 둔다: "SIGLENS AI가 어떻게 답하는지 보기".
- 기능 칩 "실시간 시세"를 "최신 시세"로 바꾼다. 한국 주식은 지연 시세라 "실시간"이 틀린 말이다.
- 루트의 h1, 설명, 기능 칩, 예시 질문은 남긴다. 루트가 텅 비지 않게 하려는 것이다(색인 대상이 둘로 늘어나는 대신 검색 의도를 나눈다: 루트는 "주식 AI 챗봇", `/about`은 "작동 방식·비교").
- `AiLanding` JSDoc에 있던 "루트에만 두는 이유"는 이 결정으로 뒤집힌다. 근거는 이 문서에 남긴다.

## SEO

- `/about` 메타데이터: 인덱스 허용 게이트는 루트와 같다(`STATIC_INDEXABLE_LOCALES`). canonical, hreflang, OG, twitter를 넣는다. `aiSeo.ts`의 URL 헬퍼를 경로 인자를 받게 일반화한다.
- JSON-LD: `FAQPage`(`buildFaqJsonLd`, 화면 FAQ와 같은 배열에서 만든다).
- ai 호스트 `sitemap.xml`(`proxy.ts`의 `aiSitemapXml`)에 `/about`을 추가한다.
- 페이지는 서버 렌더다. 크롤러는 JS 없이 전 섹션 텍스트를 받는다. 대화 재생의 초기 HTML에는 첫 시나리오의 완성된 대화를 SSR로 넣고, 하이드레이션 뒤에 비우고 타이핑을 시작한다.

## 구조 (FSD)

| 파일 | 역할 |
|---|---|
| `src/app/ai/[locale]/about/page.tsx` | 라우트. 메타데이터, JSON-LD, `AiAboutPage` 렌더 |
| `src/app/ai/[locale]/aiSeo.ts` | `aiUrl(locale, path)`, `buildAiAboutMetadata` 추가 |
| `src/views/ai-about/AiAboutPage.tsx` | 서버 컴포넌트. `getTranslations('views.ai-about')`로 모든 문구를 풀어 섹션을 조립하고, 재생 데이터를 직렬화 가능한 props로 넘긴다 |
| `src/views/ai-about/ui/ChatReplay.tsx` | 클라이언트. 재생 상태 머신 |
| `src/views/ai-about/ui/AboutCtaBar.tsx` | 클라이언트. 헤더 숨김 여부에 따라 top 값이 바뀌는 고정 바 |
| `src/views/ai-about/lib/replayScript.ts` | 순수 함수. 답변 마크업 파싱(`<b>`, `<up>`, `<down>`), 부분 렌더 슬라이스, 다음 시나리오 선택, 스텝 타임라인 |
| `src/views/ai-about/index.ts` | 배럴 |
| `src/widgets/agent-chat/index.ts` | 아이콘 재수출(데이터 칸 아이콘 재사용) |

문구는 전부 `messages/ko.json`의 `views.ai-about.*`에 둔다. 서버에서 풀어 넘기므로 클라이언트 메시지 네임스페이스(`AI_CLIENT_PATHS`)는 바꾸지 않는다. 키는 정적 `t('…')`/`t.raw('…')` 호출로만 참조해서 추출기가 보존하게 한다. en/ja/zh는 `yarn i18n:translate`로 만든다.

## 스타일

- 기존 토큰만 쓴다. 반경은 `rounded` / `rounded-lg` / `rounded-full` 3단계만 쓴다.
- 카드는 `SURFACE_CARD`, 섹션 제목은 `HEADING_SECTION`을 쓴다.
- 등락 텍스트 색은 `ui-success-text` / `ui-danger-text`를 쓴다.
- 한글 라벨에는 `font-mono`와 `uppercase`를 쓰지 않는다.
- 그림자는 떠 있는 요소(CTA 바)에만 쓴다.
- 다크와 라이트 두 테마를 모두 지원한다.

## 검증

- 유닛 테스트: `replayScript` 순수 함수, `ChatReplay` 렌더(정지 상태, reduced-motion), `AiAboutPage` 렌더(섹션, FAQ JSON-LD 단일 출처), `aiSeo` 메타데이터, `aiSitemapXml`, `EmptyState`(랜딩 제거, about 링크).
- 전역 가드: `src/__tests__/guards` 포함 전체 스위트를 push 전에 1회 돌린다.
- e2e: SEO 스펙에 `/about` 200, canonical, FAQPage를 추가하고, sitemap 기대값도 갱신한다.
- 로컬 dev에서 curl로 SSR 본문과 메타를 확인한다. 화면 확인은 사용자에게 요청한다.
