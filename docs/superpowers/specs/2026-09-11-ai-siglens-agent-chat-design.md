# SiglensAI(ai.siglens.io) — 대화형 AI(에이전트 챗) 상세 설계 (v2.2)

> 2개 레포 동시 적용: `siglens-core`(에이전트 루프·툴 스키마·프롬프트·한도 정책), `siglens`(어댑터·툴 실행기·SSE·DB·UI·인프라).
>
> **기준 시점 2026-09-11** — siglens `master 37b486ed0`(v0.72.x) / core pin `1.0.4`.
>
> v2는 v1(같은 날)을 리뷰어 3명(요구사항 적합성·코드 대조·보안/비용/과잉설계, 총 75건)으로 검토해 전면 개정한 것이다.
> v2.2(2026-09-12)는 계획 교차 검토(코드 대조 13건) + 사용자 추가 요구 4건(SSO·포트폴리오 연동·제품명 SiglensAI·DeepSeek flash 고정/추론 차단·siglens 톤)을 반영했다. 반영 내역은 §17. 설계 원칙은 그대로: **추측 금지**, 모든 "가능"은 코드 실측 또는 실제 호출로 확인(§14).

---

## 1. 목표·비목표

### 1-1. 목표(사용자 요구사항 8개에 1:1 대응)

| # | 요구 | 충족 방식 |
|---|---|---|
| R1 | `ai.siglens.io`에서 ChatGPT식 대화 | 호스트 기반 라우팅으로 같은 Next 앱이 서빙(§2-2, §9) |
| R2 | siglens 분석 데이터(DB·Redis·core) 기반 답변 | `get_cached_analysis`가 Redis → 스냅샷 → 이력 순으로 조회(§7) |
| R3 | 툴: 웹 검색·siglens 데이터·core 함수 호출 | 툴 8종(§7), 웹 검색은 Brave(§2-7) |
| R4 | 캐시에 없으면 core로 **실제 분석 실행** | `run_fresh_analysis`가 한도 안에서 **자동 실행**(§4-2, §7-3). 확인 버튼 없음 |
| R5 | 뉴스·옵션 등 풍부한 정보 활용 | `get_news`(본문 포함 옵션)·`get_options_summary`·커버리지 부족 시 검색 유도 규칙(§4-3) |
| R6 | 대화방·세션 상태 참조 | 회원 대화를 Neon에 저장, 최근 8턴 원문 주입(§6, §4-4) |
| R7 | 운영비 증분은 LLM 사용료 수준 | 인프라 $0, 기본 모델 200턴/일 월 $21~47(§10), 킬 스위치·알람(§12) |
| R8 | 툴 콜링·상태 저장 구현 | 4사 실키 프로브로 검증된 포트·루프(§4, §5, §14-B) |
| R9 | 회원 자산(보유종목) 연동 | `get_my_portfolio` 툴 + 시스템 프롬프트에 보유 심볼 주입(§7, §4-3) |
| R10 | siglens 로그인이 ai.siglens.io에서도 유효(SSO) | 1회용 코드 핸드오프(§2-3, §9-4) |
| R11 | 제품명 **SiglensAI**(가칭), siglens 톤 디자인 | §9-2 |
| R12 | 파일럿: 모델 DeepSeek flash 고정, 추론 차단 | §2-5·2-6, 모델 선택 UI 없음 |

### 1-2. 비목표(1차 범위 밖)

- 비회원 채팅(로그인 CTA만). 매매·주문·쓰기 툴. 파일·이미지·음성 입력. 대화 공유 링크.
- 대화 요약 압축, `provider_meta` 저장, 추론(thinking) 토글, **모델 선택 UI·Anthropic/OpenAI/Gemini 어댑터·폴백** — 전부 P3 이후(§15). 파일럿은 DeepSeek flash 단일.
- 모노레포·레포 분리(§2-1). 세션 쿠키 도메인 확장(§2-3, v1에서 폐기).

---

## 2. 확정 결정 (근거 + 기각 대안)

| # | 결정 | 근거 | 기각 |
|---|---|---|---|
| 2-1 | **같은 레포·같은 Next 앱** | 어댑터·DB·인증·배포를 그대로 상속. 분리 시 셋째 패키지가 SCOPE 원칙을 깸. 모노레포는 FSD·oxlint·Dockerfile·CI 게이팅 전부 단일 루트 전제 | 별도 레포 · workspaces |
| 2-2 | 호스트 라우팅 `ai.siglens.io/*` → `app/ai/[locale]/*`, 자체 `<html>` 레이아웃 | 루트 `app/layout.tsx`가 패스스루, `[locale]/layout.tsx`가 `<html>`을 렌더하는 기존 패턴의 형제 복제. 페이지 이동 0건(`@/app/[locale]` 절대 import 102파일) | route group 이동 · 클라이언트 host 분기 |
| 2-3 | **세션 쿠키는 host-only 유지 + 1회용 코드 핸드오프로 SSO(R10).** 인증 페이지·OAuth는 메인 호스트에만 둔다. ai 호스트에 세션이 없으면 `siglens.io/api/auth/handoff?to=ai&next=…`로 보내고, 메인이 세션을 확인해 60초 1회용 코드를 발급, ai 호스트가 코드를 소비해 **자기 host-only 세션**을 만든다(§9-4) | `.siglens.io` 확장은 `auto-trade`·`beta` 등 존의 모든 서브도메인에 토큰을 뿌리고 롤백 불가. `next`는 경로 전용, 호스트는 `to=ai` enum으로만. 핸드오프는 라우트 2개 + Redis `getdel`(기존 `pendingOAuthSignupStore` 패턴) | 도메인 확장 · 절대 URL `next` 허용목록 · ai 서브트리 인증 페이지 re-export + OAuth 호스트별 콜백(v2, 콘솔 등록·중복 렌더 부담) |
| 2-4 | 루프·툴 스키마·프롬프트·한도는 **core 1.1.0**, 툴 실행기·어댑터·DB·UI는 siglens | SCOPE §0 표("챗 프롬프트 빌더", "사용량 제한 정책" → core / "Repository·SDK 어댑터·UI" → siglens) | 루프를 siglens에 |
| 2-5 | 1차 프로바이더 **DeepSeek 단일**(R12). Anthropic(폴백 포함)·OpenAI·Gemini는 P3 | 4사 모두 실키 프로브 성공(§14-B)이라 확장 경로는 열려 있음. 파일럿은 모델 고정이라 폴백 없이 DeepSeek 장애 = 서비스 일시 불가(킬 스위치·알람으로 대응). 9/14 라우팅 변경은 v4-pro만 해당, flash 무관 | DeepSeek+Haiku 폴백(v2) · 4사 동시 · Vercel AI SDK |
| 2-6 | 모델 `deepseek-v4.1-flash` **고정**(클라이언트 `model` 값 무시), 추론 OFF 고정 | 사용자 결정(파일럿). 턴당 $0.0036~0.0079. 회원 모델 한도·BYOK 경로는 core에 남기되 1차엔 도달 불가 | 모델 선택 UI |
| 2-7 | 웹 검색 **Brave Search API**, 전역 일/월 상한 | 프로바이더 무관, 월 $5 무료 크레딧=1,000회, 초과 $5/1k. Anthropic 검색은 $10/1k·Claude 전용, Gemini grounding은 Gemini 전용 | Tavily · 내장 검색 |
| 2-8 | **회원 전용**(1차). 비회원은 랜딩+로그인 CTA | 비회원 `clientHistory`는 가짜 툴 결과 위조 경로, IP 한도는 UA·IP 우회 쉬움, 서버 키를 무인증 트래픽에 노출. 별도 저장소·한도 체계도 사라짐 | 비회원 5턴/일 |
| 2-9 | 신선 분석은 **한도 안에서 자동 실행**, 턴당 1회 | R4 원문("실제로 데이터를 분석"). 달러 비용은 회당 $0.003~0.01. 제약은 지연(30~250초)·동시성이라 세마포어와 마감으로 관리 | 확인 버튼 게이트(v1) |
| 2-10 | 한도는 기존 `enableTierRestrictions`와 독립된 `AGENT_LIMITS`. **Redis 불가 시 fail-closed** | `checkChatbotLimit`은 플래그 off면 무조건 true. fail-open은 Upstash 장애 동안 서버 키 무제한 소진(일일 명령 한도 소진 사례가 런북에 실재) | tokenStore식 fail-open |
| 2-11 | SSE는 전용 writer `agentEventStream`(fetch + ReadableStream 소비) | `heartbeatStream`은 Promise 1개 결과만 보내는 계약(`event: open/heartbeat/done/error`)이라 토큰 스트리밍 불가. 알람 마커 `[analysis-stream] failed:`는 건드리지 않음 | heartbeatStream 확장 |
| 2-12 | 컨텍스트는 **최근 8턴 원문 + 툴 결과는 최근 2턴**, 그 이전은 버림 | 32k 예산에 충분. 요약 압축은 대화 길이 분포가 생긴 뒤(P3) | 요약 압축 1차 포함 |
| 2-13 | 툴 실행기는 `src/app/api/ai/chat/tools/`(app 레이어) | oxlint가 `features/**`의 entity 딥 import를 금지하고, `fetchOptionsSnapshot`·`searchTicker` 등 서버 전용 함수는 배럴 미노출(클라 번들 누출 방지). 분석 스트림 라우트가 같은 패턴(`runAnalysisBridge.ts`) | features 슬라이스 + 배럴 확장 |
| 2-14 | 턴 마감 600초, 신선 분석 타임아웃 300초. 배포 drain 180초와의 불일치는 **기존 분석 라우트와 같은 수용 트레이드오프** | 실측 248초 + 마무리 호출 여유. drain을 올리면 인스턴스 롤이 7분씩 늘어남(런북) | 마감 180초 |

---

## 3. 시스템 개요

### 3-1. 요청 흐름

```
브라우저(ai.siglens.io/c/{id})
  │ POST /api/ai/chat/stream {conversationId?, message, model, action:'send'|'regenerate'|'edit'}
  ▼
route handler (siglens)
  ├─ AGENT_CHAT_DISABLED → 503
  ├─ getCurrentUser 없음 → 401 · isBot → 403
  ├─ resolveTierAndByok(model) · 대화 소유자 검증(where id = ? and user_id = me, 없으면 404)
  ├─ 동시 턴 락(Redis SET NX EX 720 = 턴 마감 600초 + 여유 120초 — 락을 pre-turn DB 읽기 앞에서 잡고 Neon 재시도는 in-flight 호출을 끊지 못해 최악 50~60초가 선행, 토큰 compare-and-delete 해제, Redis 장애 시 fail-closed + `[agent] quota store unavailable` 로그) · 일일 턴 한도(Redis, fail-closed)
  ├─ user 메시지 저장(seq = max+1, 트랜잭션)
  ├─ core.runAgentTurn(params, deps) ──┐
  │     루프: callAgentProvider(stream) → tool_use? → deps.executeTool → 결과 append → 재호출
  │     이벤트: text/tool_start/tool_end/usage/done/error → agentEventStream이 SSE 프레임으로
  ├─ deps.callAgentProvider = agentRouter(DeepSeek → 실패 시 Haiku 폴백)
  ├─ deps.executeTool = app/api/ai/chat/tools 레지스트리
  └─ finally: assistant·tool 메시지 저장, 락 해제, activeStreams 감소, [Usage]/[Agent] 로그
```

### 3-2. 레포별 컴포넌트

**siglens-core (1.1.0)**

| 모듈 | 책임 |
|---|---|
| `domain/ports/agentProvider.ts` | `AgentMessage`·`AgentToolSpec`·`AgentStreamEvent`·`CallAgentProvider`(§4-1) |
| `domain/types.ts` | `NormalizedUsage`를 infrastructure에서 domain으로 이동해 export(§4-1 주). `UsageLogFields`·추출기 호출부 동반 수정 |
| `domain/agent/tools.ts` | 툴 카탈로그(이름·설명·JSON Schema·costClass)와 스키마 검증(`validateArgs`, 순수). 심볼 형태 검증은 siglens 실행기 몫(`isAdmissibleSymbolShape`는 siglens 전용) |
| `domain/agent/buildAgentSystemPrompt.ts` | §4-3 |
| `domain/agent/selectHistoryWindow.ts` | 최근 N턴·툴 결과 창 선택(순수) |
| `application/agent/runAgentTurn.ts` | 루프·상한·한도 소비/환불·usage 집계·에러 매핑. `toChatErrorResult`를 `application/shared/providerError.ts`로 추출해 공유 |
| `application/agent/limits.ts` | `AGENT_LIMITS`(§4-5) |
| `infrastructure/usage/dailyCounterStore.ts` | 기존 `tokenStore.ts`의 INCR+EXPIRE를 prefix·limit·**failurePolicy('open'\|'closed')** 로 매개변수화한 범용 카운터. tokenStore는 `'open'`(기존 계약 유지), 에이전트는 `'closed'`. 두 정책 모두 테스트(§13) |

**siglens**

| 위치 | 책임 |
|---|---|
| `entities/llm-provider/api/agent/{deepseek,anthropic}.ts`, `agentRouter.ts`, `lib/serverKeys.ts` | 포트 구현. `getServerPrimaryKey`를 `chatAction.ts`에서 `lib/serverKeys.ts`로 이동해 공유. ModelId → apiModelId 변환은 라우터에서 1회 |
| `entities/chat-conversation/{api.ts,model.ts,actions/}` | Drizzle 스키마·리포지토리·서버 액션(list/get/rename/delete) |
| `app/api/ai/chat/stream/route.ts`, `app/api/ai/chat/tools/*.ts`, `app/api/ai/chat/agentEventStream.ts` | SSE 라우트·툴 실행기·스트림 writer |
| `features/agent-chat/` | `useAgentStream`(SSE 소비·abort·regenerate·edit), 로컬 상태 |
| `widgets/agent-chat/` | ChatShell·Sidebar·MessageList·Composer·ToolActivity·EmptyState·AgentMarkdown |
| `app/ai/[locale]/{layout,page}.tsx`, `c/[id]/page.tsx`, `not-found.tsx`, `app/ai/[locale]/{login,signup,forgot-password,reset-password,signup/oauth/consent}/page.tsx`(메인 페이지 모듈 re-export) | 라우트 |
| `src/proxy.ts` | 호스트 분기(§9-1) |
| `scripts/i18n/extract.mjs`, `shared/i18n/*` | 로케일 루트를 `['src/app/[locale]', 'src/app/ai/[locale]']`로 일반화(§9-3) |
| `infra/aws/07-alarms.sh`, `check-env.sh`(`OPTIONAL_KEYS`에 `BRAVE_SEARCH_API_KEY`), `.env.example` | 알람·env |

---

## 4. core: 포트·루프·프롬프트·한도

### 4-1. 타입 (`domain/ports/agentProvider.ts`)

```ts
export type AgentRole = 'user' | 'assistant' | 'tool';
export interface AgentToolCall { id: string; name: string; args: Record<string, unknown> }

export interface AgentMessage {
    role: AgentRole;
    content: string;              // user/assistant 텍스트, tool은 실행기가 4,000자로 절단한 결과 JSON
    toolCalls?: AgentToolCall[];  // assistant
    toolCallId?: string;          // tool
    toolName?: string;
}
// 1차엔 providerMeta 없음. 추론 ON(DeepSeek reasoning_content, Gemini thoughtSignature, Claude thinking 블록)이
// 필요해지는 P3에서 `providerMeta?: { provider, model, raw }`와 DB 컬럼을 함께 추가한다.

export interface AgentToolSpec {
    name: string; description: string;
    inputSchema: JsonSchemaObject;     // draft-07 부분집합. DeepSeek strict 제약과 교집합(minLength/maxLength/minItems 미사용)
    costClass: 'free' | 'cached' | 'expensive' | 'external';
}

export type AgentStopReason = 'end' | 'tool_use' | 'max_tokens' | 'other';
export type AgentStreamEvent =
    | { type: 'text'; delta: string }
    | { type: 'tool_call'; call: AgentToolCall }
    | { type: 'usage'; usage: NormalizedUsage }
    | { type: 'stop'; reason: AgentStopReason };

export interface CallAgentProviderOptions {
    apiKey: string; model: ModelId;    // 라우터가 키 1개로 축약하고 apiModelId로 변환
    system: string; messages: AgentMessage[]; tools: AgentToolSpec[];
    maxOutputTokens: number; signal: AbortSignal;
    onEvent: (e: AgentStreamEvent) => void;
}
export interface AgentProviderResult {
    text: string; toolCalls: AgentToolCall[]; stopReason: AgentStopReason; usage: NormalizedUsage;
}
export type CallAgentProvider = (o: CallAgentProviderOptions) => Promise<AgentProviderResult>;
```

### 4-2. 루프 (`application/agent/runAgentTurn.ts`)

입력 `{ userId, tier, model, locale, history: AgentMessage[], userMessage, now }`
의존 `{ callAgentProvider, executeTool(name, args, ctx), counters(dailyCounterStore), usageLogs?, signal }`

```
1. turnsPerDay 소비(INCR). 한도 초과 → 'turn_limit'. Redis 오류 → 'server_busy'(fail-closed).
2. tools = catalog(tier, params.availableTools)  // 가용 집합은 siglens가 계산해 넘김(`isE2E()`·Brave 키 부재 시 web_search 제외) — core는 isE2E를 모른다
   system = buildAgentSystemPrompt({ locale, tier, tools, now })
3. messages = selectHistoryWindow(history, { turns: 8, toolResultTurns: 2 }) + user
4. for step in 1..MAX_STEPS(6):
     r = callAgentProvider({... messages, onEvent})           // 텍스트는 즉시 스트림
     if r.stopReason !== 'tool_use' || r.toolCalls.length === 0: break
     if 누적 툴 호출 > MAX_TOOL_CALLS(8): 초과 호출은 {error:'quota', scope:'per_turn_tools'} 결과로 돌려주고(모델이 그 결과를 보고 답변으로 전환), 마지막 스텝(6)에서는 tools를 비워 종료를 강제
     for call in r.toolCalls (병렬, allSettled):
         validateArgs(spec, args)                 실패 → {error:'invalid_args', issues}
         executor 게이트(심볼 형태·티어·턴당/일일 툴 한도·전역 검색 상한)  실패 → {error:'quota'|'not_allowed'}
         result = executeTool(...) with timeout(costClass)     초과 → {error:'timeout'}
         emit tool_start / tool_end
     messages.push(assistant(toolCalls), tool results)
5. 반환 { ok:true, assistant, intermediate(assistant(toolCalls)+tool 메시지 순서대로), usage 합계·steps·ms, stopReason, remaining, promptVersion, toolsUsed }
6. 프로바이더 429/503/네트워크 → 턴 환불(DECR), 에러 코드 매핑. AbortSignal → 'aborted'(환불 없음, 부분 저장)
```

상한(core 상수): `MAX_STEPS=6`, `MAX_TOOL_CALLS_PER_TURN=8`, `MAX_WEB_SEARCH_PER_TURN=2`, `MAX_FRESH_ANALYSIS_PER_TURN=1`,
`MAX_DISTINCT_SYMBOLS_PER_TURN=3`(FMP·Yahoo 호출 폭 제한), `TURN_DEADLINE_MS=600_000`,
툴 타임아웃 `free/cached 10s · external 8s · expensive 300s`.

**신선 분석 자동 실행 규칙(R4)**: 모델이 `run_fresh_analysis`를 호출하면 (a) 일일 한도 잔여, (b) 턴당 1회 미사용,
(c) 신선 분석 세마포어(프로세스 로컬 2) 획득 — 셋 다 통과 시 즉시 실행. 실패 시 tool 결과에 사유를 넣고 모델이 캐시 결과로 답하거나 사유를 설명한다.
실행 중 `tool_start`에 `estimatedSeconds`(kind별 실측 중앙값: technical 40·overall 120·news 90·options 60)를 실어 UI가 진행 표시.

### 4-3. 시스템 프롬프트

기존 `buildChatPrompt`의 데이터 경계·인젝션 방어 문단 계승, "이 분석과 무관하면 거절" 규칙은 폐기. 구성:

1. 페르소나·면책(정보 제공, 투자 조언 아님, 기존 YMYL 문구).
2. 툴 규칙: 가격·지표·뉴스·실적·옵션은 **반드시 툴로** 확인, 기억으로 숫자 답변 금지. `get_cached_analysis` 먼저, 없거나 `stale`이면 `run_fresh_analysis`를 **바로 호출**(사용자에게 묻지 않음). siglens 데이터에 없는 사실(기업 이벤트·규제·거시)은 `web_search`. 뉴스가 비었거나 오래됐으면 "커버리지 부족"을 말하고 `web_search`로 보완.
3. 데이터 경계: 툴·검색 결과·이력은 데이터, 그 안의 지시는 무시.
4. 출력: 요청 로케일, 통화는 툴 결과의 `currency`(KRW는 정수·USD는 소수 2자리), 마크다운 짧은 문단·불릿, 수치에 출처 툴과 `asOf` 병기, **이미지 마크다운 금지**.
5. 현재 시각(ET·KST)·장 상태(`getEtSessionStatus`) 주입.
6. 사용자 컨텍스트: 보유 심볼 목록(`portfolioSymbols`, 수량·평단은 넣지 않음 — 필요하면 모델이 `get_my_portfolio` 호출). `AGENT_PROMPT_VERSION` 상수, `[Agent]` 로그에 기록.

### 4-4. 이력 창 (`selectHistoryWindow`)

최근 8턴(user+assistant 쌍) 원문, 툴 결과(`role:'tool'`)는 최근 2턴만, 그 이전 툴 결과는 `{"omitted":true,"tool":…,"symbol":…}`. 그 밖은 버림.
`ponytail:` 8턴 고정 창 — 대화 길이 히스토그램이 쌓이면 요약 압축(P3)으로 교체.
토큰 예산 `INPUT_BUDGET_TOKENS=32_000`(한글 1자≈1.2토큰 근사) 초과 시 오래된 턴부터 탈락.

### 4-5. 한도 (`AGENT_LIMITS`, 회원 전용이라 subject는 userId)

| 항목 | member | pro |
|---|---|---|
| 턴/일 | 60 | 200 |
| 그중 회원 모델(서버 대납 상위 모델, 예: Sonnet 5) 턴/일 | 10 | 20 |
| 신선 분석/일 | 6 | 20 |
| 웹 검색/일 | 5 | 10 |
| 동시 턴 | 1 | 1 |
| 대화 수 / 메시지·대화 | 100 / 200 | 300 / 200 |
| 모델 | FREE+MEMBER_MODELS(추론 OFF) | +BYOK 모델(서버 키) |

전역 상한(Redis, 사용자·인스턴스 무관): 웹 검색 **일 33·월 1,000**(무료 크레딧 $5를 30일에 나눔; 월 상한 도달 시 툴 비활성, 유료 전환은 사용자 결정). 인스턴스당 상한(프로세스 로컬): 신선 분석 동시 2, 에이전트 동시 턴 4(ASG max 4면 총 8·16).
Redis 키 `agent:q:{feature}:{userId}:{yyyy-mm-dd}`(**UTC 날짜**, 기존 `hashUsageIp`와 같은 규칙. ET 대비 최대 4~5시간 어긋나지만 일일 한도엔 무해). `INCR` 후 `EXPIRE NX 86400`.
Redis 오류 → 해당 요청 `server_busy`(fail-closed). regenerate·edit도 턴 1회 소비.

---

## 5. siglens: 프로바이더 어댑터

공통: `agentRouter`가 키(서버/BYOK) 1개로 축약(`lib/serverKeys.ts`의 `getServerPrimaryKey` + `resolveTierAndByok`의 `userApiKey`), `MODEL_SPECS[model].apiModelId`로 변환, `[Usage]` `jobId:'agent'`.
`maxOutputTokens`: 추론 OFF 모델은 **4,096**. 추론이 켜지는 P3에서는 adaptive Claude가 thinking과 max_tokens를 공유하므로 스펙값(128k)을 쓴다 — 1차엔 해당 없음.

| 프로바이더 | 요청 | 스트림 | tool result 되돌림 | 근거 |
|---|---|---|---|---|
| DeepSeek (`openai` SDK chat.completions) | `tools:[{type:'function',function}]`, `thinking:{type:'disabled'}` | `delta.tool_calls[i].function.arguments` 누적, `finish_reason:'tool_calls'` | `role:'assistant', tool_calls` + `role:'tool', tool_call_id` | §14-B1 |
| Anthropic (`@anthropic-ai/sdk`) | `tools:[{name,input_schema}]` 마지막 항목·`system`·직전 user 턴의 **마지막 블록**에 `cache_control`(기존 `withHistoryCacheBreakpoint`는 문자열 content 전용이라 새 헬퍼 `withAgentCacheBreakpoints`) | `input_json_delta` 누적, `stop_reason:'tool_use'` | `assistant.content` 블록 + `user.content:[{type:'tool_result'}]` | §14-B2 |

폴백: 스텝 호출이 DeepSeek 5xx/429/네트워크로 실패하면 **같은 스텝을** `claude-haiku-4-5`로 1회 재시도(캐노니컬 메시지라 변환 가능). 폴백 사용은 `[Agent]`에 기록.
P3(OpenAI Responses·Gemini) 매핑은 v1 프로브 결과(§14-B3·B4)로 이미 확인됨.

---

## 6. 데이터 모델·API

### 6-1. 테이블 (마이그레이션 `0035_agent_chat.sql`)

```
chat_conversations
  id uuid pk default gen_random_uuid()
  user_id uuid not null → users.id on delete cascade
  title varchar(120) not null            -- 첫 user 메시지 앞 60자(1차). LLM 제목은 P3
  locale content_locale not null         -- 기존 pgEnum 재사용
  model_id varchar(64) not null          -- 마지막 사용 모델(ModelId 키)
  message_count integer not null default 0
  last_message_at timestamptz not null
  created_at / updated_at timestamptz not null default now()
  index (user_id, last_message_at desc)   -- 부분 인덱스 금지: 쿼리에 `deleted_at is null`이 없으면 플래너가 부분 인덱스를 못 쓰고 목록·카운트가 전체 스캔이 된다

chat_messages
  id uuid pk
  conversation_id uuid not null → chat_conversations.id on delete cascade
  seq integer not null                   -- INSERT … SELECT coalesce(max(seq),0)+row_number() 단일 문(neon-http 드라이버는 트랜잭션 미지원). 동시 턴 락이 요청 간 경합을 막는다
  role varchar(16) not null              -- 'user' | 'assistant' | 'tool'
  content text not null                  -- tool: 실행기가 절단한 4,000자 JSON **그대로**(모델이 본 것 = 저장된 것)
  tool_calls jsonb null                  -- assistant
  tool_call_id varchar(64) null, tool_name varchar(64) null
  model_id varchar(64) null
  usage jsonb null                       -- {promptTokens,cachedTokens,cacheWriteTokens,outputTokens,steps,ms,fallback:boolean}
  status varchar(16) not null default 'complete'   -- 'complete' | 'aborted' | 'error' | 'superseded'(regenerate로 대체된 assistant·tool 행)
  created_at timestamptz not null default now()
  unique (conversation_id, seq)
```

용량: 메시지 평균 ≤ 1.5KB(tool 4KB 상한) × 활성 회원 월 200건 ≈ 300KB~800KB/월/활성회원. `provider_meta` 없음.

### 6-2. 서버 액션 (`entities/chat-conversation/actions/`)

`listConversationsAction()`, `getConversationAction(id)`, `renameConversationAction(id,title)`, `deleteConversationAction(id)`(**하드 삭제** — 행을 지우고 `chat_messages`는 FK cascade로 함께 사라진다. 개인정보 고지가 '삭제 시 즉시 파기'를 약속하므로 soft delete로는 문서와 코드가 어긋난다. 소유자·UUID 검증은 동일). 파일럿은 커서 페이징 없이 목록 상한 300(= 최대 티어 대화 수 상한 pro 300) — 상한보다 적게 보이면 오래된 대화가 사이드바에서 사라진 채 한도만 차감된다. 티어 상한이 커지면 `lastMessageAt`+`id` 커서로 전환. 모든 액션·리포지토리는 비-UUID id를 DB에 보내지 않고 not-found로 처리한다(22P02→500 방지).
전부 `getCurrentUser` 필수, `where user_id = me`(삭제는 행을 지우므로 추가 조건 없음).

### 6-3. SSE 라우트 `POST /api/ai/chat/stream`

```json
{ "conversationId": "uuid|null", "message": "…",
  "action": "send" | "regenerate" | "edit", "editSeq": 12 }
// 모델은 서버 고정(deepseek-v4.1-flash). 클라이언트가 보내는 model 필드는 무시한다.
```
- `send`: 새 user 메시지. `regenerate`: 마지막 assistant(및 그 tool) 행을 `status:'superseded'`로 표시 후 재실행. `edit`: `editSeq` 이후 행을 삭제하고 새 user 메시지로 재실행. 셋 다 턴 1회 소비.
- 검증: message 1~4,000자(regenerate 제외), `editSeq` 정수, 소유자 검증(§3-1).
- 이벤트(`event:`/`data:` 프레이밍, 25초마다 `event: heartbeat` — 기존 파서와 동일 형태):
```
meta        {conversationId, userMessageId, model, title?}
text        {delta}
tool_call   {call:{id,name,args}}          -- 프로바이더가 인자 완성 시 1회(UI는 무시 가능)
tool_start  {id, name, args(스키마 필드만), estimatedSeconds?}
tool_end    {id, name, status:'ok'|'error', ms, summary}
usage       {usage:{promptTokens, cachedTokens, cacheWriteTokens, outputTokens, steps, ms}}
done        {assistantMessageId, remaining:{turns,fresh,search}, stopReason:'end'|'max_tokens', title?}
error       {code, message}   -- code: turn_limit|premium_turn_limit(1차 도달 불가)|rate_limited|server_busy|server_error|deadline|aborted. HTTP 단계 거부는 401/403/404/409/503 JSON
```
- 동시성: `activeStreams.ts`에 `registerActiveStream(): () => void`(증가 + 해제 함수)를 추가하고 `heartbeatStream`도 그것을 쓰도록 바꾼다(현재 `increment/decrement`는 "heartbeatStream 전용, 직접 호출 금지"로 문서화돼 있어 계약 변경을 명시). 에이전트 턴 = 1 슬롯, `run_fresh_analysis` 실행기가 실행 동안 1 슬롯 추가 → 중첩 분석도 24 상한에 잡히고, 라우트 진입 시 `canAcceptAnalysisStream()`도 검사한다(에이전트가 공개 분석 라우트의 24 슬롯을 나눠 쓴다는 뜻). 에이전트 자체 상한 4는 **인스턴스당**(프로세스 로컬, ASG max 4면 총 16) 초과 → `server_busy`.
- 중단 의미: 클라이언트 연결이 끊기면 `AbortSignal`로 **프로바이더 스트림과 무료·외부 툴**을 중단하고 `finally`에서 감소·락 해제·부분 저장(`aborted`). 단 `run_fresh_analysis`에는 시그널을 **넘기지 않는다** — core `dedupeInFlight`가 같은 캐시 키의 프리웜·심볼 페이지 요청을 한 promise로 묶어 두므로 시그널을 넘기면 남의 분석까지 죽는다(기존 `heartbeatStream`이 클라이언트 시그널을 안 넘기는 이유와 동일). 분석은 끝까지 돌아 캐시에 남는다.
- 배포 drain(180초) 중 진행 턴은 잘릴 수 있음 → `error:deadline`으로 UI 재시도 안내(§2-14). 재시도 = 재생성(턴 1회 소비).
- 이력 조립: `listMessages` 후 `send`/`edit`는 새 user 행을 append하므로 이력 전체가 과거 턴이고, `regenerate`만 마지막 user 행을 잘라 `userMessage`로 넘긴다(과거 assistant 턴을 잘못 자르면 문맥이 사라진다).

---

## 7. 툴 카탈로그 (1차 9종)

스키마는 core `domain/agent/tools.ts`, 실행기는 `app/api/ai/chat/tools/`. 반환마다 `{ asOf, source, currency?, decimals? }` 메타.
**절단 규칙은 하나**: 실행기가 4,000자로 자르고 `truncated:true` 표시. DB·모델·UI가 같은 문자열을 본다. 실행기 게이트에서 `isAdmissibleSymbolShape`로 심볼 형태 검증.

| 툴 | 인자 | 소스(실측 함수) | 비고 |
|---|---|---|---|
| `search_ticker` | `query` | `entities/ticker/lib/searchTicker` | 후보 ≤ 8 |
| `get_quote` | `symbols[≤3]` | `const profile = await resolveMarketProfile(symbol); getCachedMarketDataProvider(sessionSpecFor(profile)).getQuote(symbol)` — 분석 스트림 라우트와 같은 2단계(`sessionSpecFor`는 심볼이 아니라 프로필을 받음). KR은 Yahoo 경로, FMP는 KRX 미지원 | 심볼별 병렬 |
| `get_bars_indicators` | `symbol, timeframe, bars≤60` | core `fetchBarsWithIndicators` + `detectSignals` + `classifyTrend` | 최근 N봉·최신 지표값·신호·추세 |
| `get_cached_analysis` | `symbol, tab, timeframe?` | technical: `peekAnalysisCache(symbol, tf, undefined, model, false, tier, cfg, positionBucket?)`가 **`{result, lockedInfoDepth}`**를 돌려줌(`result`를 읽는다). overall: `peekOverallAnalysisCache`(modelId 없으면 무조건 null). 6탭 전부: `seo_analysis_snapshots`(locale) → `analysis_history` 최신(`AnalysisHistoryTab`은 technical\|overall) | `stale`·`source` 표시. positionBucket은 보유종목이 있으면 `resolvePositionBucket(tier, avgPrice, quote)`로 계산(개인화 캐시 키) |
| `get_news` | `symbol?` \| `category?`(enum: general\|stock\|crypto\|forex\|articles\|kr), `since?`, `query?`, `limit≤10`, `includeBody?` | `news.listBySymbol` / `market_news.listByCategory(sentinel)` — slug를 `CATEGORY_CONFIG[id].sentinel`로 매핑(`__NEWS_GENERAL__` 등) | 제목(`titleLocalized ?? titleKo ?? titleEn`)·요약·감성·priceImpact·url. `includeBody`면 상위 3건 본문 1,000자 |
| `get_options_summary` | `symbol` | `fetchOptionsSnapshot` + core `summarizeChainForLlm` | 옵션 시장 없으면 `{available:false}` |
| `get_my_portfolio` | 없음 | `DrizzlePortfolioRepository.findByUser(userId)` | 보유 종목·수량·평단·통화. 회원 본인만(R9). 개인정보 고지 §8 |
| `run_fresh_analysis` | `symbol, kind: technical\|overall\|news\|options, timeframe?` | 분석 스트림 라우트와 같은 deps로 `runAnalysis`·`runOverallAnalysisAction`·`submitNewsAnalysisAction`·`submitOptionsAnalysisAction`. 분석 모델은 **사용자의 분석 모델 선택**(캐시 키가 모델별) | 자동 실행(§4-2). core `dedupeInFlight`로 프리웜과 중복 없음 |
| `web_search` | `query, freshness?: day\|week\|month` | Brave `GET /res/v1/web/search`(fetch) 상위 5건 {title,url,snippet,age} | 스니펫만. 페이지 본문 fetch 툴 없음. `isE2E()`·키 부재 시 카탈로그에서 제외 |

P4 후보: `get_asset_info`, `get_earnings`, `get_financials`, `get_market_overview`, `get_economic_calendar`(`getCalendarFromDb(anchorEt, country, locale)`라 실행기가 anchorEt 계산·days 필터), `get_congress_trades`(`degraded` 플래그를 결과에 노출).
툴 스키마는 호출마다 prefix 토큰을 먹으므로(툴당 150~250) 실사용 로그가 요구할 때만 추가.

---

## 8. 보안·개인정보

- **인증**: 회원 전용. `/api/ai/*`는 세션 없으면 401. `isBot` 403은 보조(UA 기반, 우회 가능 — 의존하지 않음).
- **엣지**: Cloudflare 무료 플랜 WAF W1~W3는 `/api`를 제외하므로 **보호 없음**. Rate Limiting 규칙(무료: 1개, 10초 창, IP 기준)을 `/api/ai/*`에 건다: 10초당 10요청 초과 시 block 10초. 이것이 사용 가능한 유일한 엣지 규칙이므로 다른 용도로 쓰지 않는다.
- **툴은 읽기 전용**, 인자는 core 스키마 검증 + 실행기 심볼 검증 후 실행. URL fetch 툴 없음(SSRF 경로 없음).
- **프롬프트 인젝션**: 툴·검색 결과는 데이터로 선언, 4,000자 절단, 스니펫만.
- **출력 위생**: `AgentMarkdown`(MarkdownText 파생)은 `img`를 렌더하지 않고 `a`는 `rel="noopener noreferrer nofollow"` + 호스트 표기. ai 호스트 응답에 proxy가 `Content-Security-Policy: img-src 'self' data:`를 붙여 이미지 비콘 유출 차단(아바타는 이니셜로 대체).
- **소유권**: 대화 읽기·쓰기·삭제 전부 `user_id = me`. 클라이언트가 보내는 이력 없음(서버 이력만).
- **키**: 서버 키 4종 + `BRAVE_SEARCH_API_KEY`(SSM, `OPTIONAL_KEYS`). BYOK는 `resolveTierAndByok` 규칙.
- **남용**: 일일·턴당 한도, 동시 턴 락, 전역 검색 상한, 메시지 4,000자, fail-closed.
- **개인정보 외부 전송**: 사용자 메시지·툴 결과(보유종목 포함)가 DeepSeek(중국)으로 전송된다. `/privacy`에 프로바이더·국가·목적·보유종목 전송을 명시하는 개정이 P2 산출물(사용자 결정으로 포트폴리오 연동은 1차 포함).
- **SSO 핸드오프**: 코드는 32바이트 난수, Redis `auth:handoff:{code}` TTL 60초, `getdel`로 1회 소비, 발급 시 `userId`·`next`(경로 전용)·`state` 저장. 호스트는 `to=ai` enum → 상수 `AI_SITE_URL`. 코드 재사용·만료·위조·state 불일치는 전부 `/?sso=none` 랜딩(로그인 CTA)으로 폴백.
- **로그인 CSRF 방지(state 바인딩)**: 공격자가 자기 계정용 코드를 받아 피해자에게 consume URL을 열게 하면 피해자가 공격자 계정으로 로그인되고 대화가 공격자에게 저장된다. 그래서 ai 호스트 `start` 라우트가 host-only state 쿠키를 심고 같은 값을 issue에 넘기며, consume은 쿠키와 저장된 state를 상수시간 비교한다(불일치여도 코드는 소모). 프로덕션에서 쿠키 이름은 `__Host-siglens_ai_sso_state`(Secure·Path=/·Domain 없음) — 형제 서브도메인이 `Domain=siglens.io`로 쿠키를 던져 넣는 cookie tossing을 막는다. 잔여 위험: issue URL 로그(state)와 consume URL 로그(code)를 60초 안에 모두 읽을 수 있는 자는 재생 가능 — 무시 가능 수준으로 수용.
- **로그인 복귀 경로**: 로케일 접두 헬퍼는 `/api/` 경로를 건드리지 않는다(`/en/api/auth/handoff` 404 방지). 세션 생성 실패(발급~소비 사이 사용자 삭제 등)는 500이 아니라 `/?sso=none`(저장된 next의 로케일 유지). `/api` 경로인 next는 로케일 루트로 바꿔 핸드오프 연쇄(홉마다 세션 생성)를 막는다.
- **`localePath` 불변식**: 출력은 절대 `//`·`/\`로 시작하지 않는다(선행 구분자·제어문자 제거 후 `/` 하나). `splitLocalePath` → `localePath` 왕복이 기본 로케일(접두 없음)에서 `/ko//evil.com`을 `//evil.com`으로 되살리던 회귀를 막는 루트 규칙이며, 프록시 `/ai//evil.com` 리다이렉트도 여기서 막힌다.
- **오픈 리다이렉트(기존 결함, 별도 hotfix)**: 공용 `toSameOriginPath`가 `/.//evil.com`의 점 세그먼트를 정규화해 `//evil.com`을 만들던 문제를 master hotfix로 수정 — 로그인·OAuth 콜백·핸드오프 모두 같은 헬퍼를 쓴다.
- **로그**: `[Agent]`에 메시지 본문 없음(툴 이름·인자 요약·토큰·ms).
- **YMYL**: 시스템 프롬프트 면책 + Composer 하단 고정 면책.

---

## 9. UI·라우팅·i18n

### 9-1. 라우팅

| ai 호스트 외부 경로 | 내부 | 렌더 |
|---|---|---|
| `/`, `/{locale}` | `/ai/{locale}` | 회원: 새 대화. 비회원: 랜딩(설명·예시·로그인 CTA) |
| `/c/{id}` | `/ai/{locale}/c/{id}` | 대화. 소유 아니면 404 |
| `/login` 등 인증 경로 | (ai 호스트에 없음) | 로그인 링크는 `https://siglens.io/{locale}/login?next=/api/auth/handoff%3Fto%3Dai%26next%3D{path}` — 메인에서 로그인 후 핸드오프로 복귀(§9-4) |
| `/api/auth/handoff/consume` | (rewrite 없음) | ai 호스트에서만 동작(§9-4) |
| `/robots.txt` | (rewrite 없음) | proxy 호스트 분기가 `User-agent: *\nDisallow: /` 본문을 **직접 반환**. matcher에 `'/robots.txt'` 항목을 추가하되 메인 호스트에서는 첫 줄에서 `NextResponse.next()`로 통과시켜 `src/app/robots.ts`가 그대로 서빙되게 한다(intl 미들웨어로 흘리면 `[locale]` 밖의 robots가 404) |
| `/api/sitemap*` | — | `/api`는 matcher 밖이므로 sitemap 라우트 자체가 `host` 헤더를 보고 ai 호스트면 404 |
| 그 외 | `/ai/{locale}/not-found` | |

`proxy.ts`: **호스트 분기를 최상단**에 둔다(그 아래 심볼 대문자화 규칙이 `/ai`를 `/AI`로 301시키기 때문). 기존 `proxy.test.ts`의 가짜 요청은 `headers`가 없으므로 `makeRequest`에 `headers: new Headers()`를 추가한다. 호스트 판정은 `host` 헤더만 쓴다(`x-forwarded-host` 폴백 없음 — 스푸핑 여지 제거).
메인 호스트에서 **첫 세그먼트가 정확히 소문자 `ai`**인 경로만 `https://ai.siglens.io/*`로 301한다(기본 로케일 strip보다 먼저, 1홉). `'ai'`는 `RESERVED_FIRST_SEGMENTS`에 넣지 **않는다** — 대문자 `AI`는 C3.ai 티커(인기 종목·sitemap 포함)라 `/AI`·`/AI/news`는 종목 페이지로 남아야 하고, 예약하면 `/Ai`가 `/AI`로 정규화되지 않는다(구현 리뷰에서 발견, 2026-09-12). ai 호스트 CSP는 `frame-ancestors 'none'; img-src 'self' data:` — 미들웨어 헤더가 next.config의 CSP를 덮어쓰므로 frame-ancestors를 함께 넣는다. 모든 sitemap 라우트가 ai 호스트에서 404.
ai 호스트 응답에 CSP 헤더 부착(`NextResponse.rewrite(url, { headers })`).
dev: `ai.localhost:3000`을 ai 호스트로 인식(`AI_HOSTS` 상수: `ai.siglens.io`, `ai.localhost`).

**OAuth**: 변경 없음 — 인증은 전부 메인 호스트에서 일어나고 ai는 핸드오프로 세션을 받는다(§9-4). OAuth 콘솔 등록 불필요.

`app/ai/[locale]/layout.tsx`: 자체 `<html>`·폰트·`LocaleProvider`·`NextIntlClientProvider`·`ReactQueryProvider`·`ThemeInitScript`·`VisitorPing`(MAU). Header·Footer·NoticePopup·PwaBanner 없음.
`generateMetadata`: `robots: {index:false, follow:false}`, `metadataBase` ai 호스트.
메인 사이트로 가는 링크(종목 페이지·계정 설정 등)는 `LocaleLink`가 아니라 절대 URL(`SITE_URL` + 경로)로 만든다 — 상대 경로면 ai 호스트에서 404. 킬 스위치(`AGENT_CHAT_DISABLED=1`)면 레이아웃이 점검 안내를 렌더한다.

### 9-4. SSO 핸드오프

```
ai.siglens.io/{path}  (세션 쿠키 없음, ?sso=none 없음)
  → 302 /api/auth/handoff/start?next={path}
ai.siglens.io/api/auth/handoff/start    (ai 호스트에서만)
  state 쿠키 Set(프로덕션 __Host-siglens_ai_sso_state)
  → 302 https://siglens.io/api/auth/handoff?to=ai&next={path}&state={state}
siglens.io/api/auth/handoff            (메인 호스트에서만)
  state 없음 → 302 ai start로 되돌림(1회, 루프 없음)
  세션 유효 → code 발급(Redis auth:handoff:{code} = {userId,next,state}, TTL 60s)
            → 302 https://ai.siglens.io/api/auth/handoff/consume?code={code}
  세션 없음 → 302 https://ai.siglens.io{next}?sso=none
ai.siglens.io/api/auth/handoff/consume  (ai 호스트에서만)
  getdel + state 쿠키 상수시간 비교 성공 → createAuthSession(userId) → 세션·힌트 쿠키 Set, state 쿠키 삭제 → 302 {next}
  실패(코드 없음·만료·state 불일치·세션 생성 실패) → 302 /?sso=none
모든 응답 Cache-Control: no-store
```

`?sso=none`이면 랜딩(로그인 CTA: 메인 로그인 → `next=/api/auth/handoff?to=ai&next=…`로 복귀). 로그아웃은 호스트별(ai 헤더의 로그아웃은 기존 `logoutAction`이 ai 쿠키의 세션만 지움). 세션 행은 호스트당 1개씩 생긴다(sessions 테이블 그대로).

### 9-2. 화면

- **ChatShell**: 좌 사이드바(대화 목록·새 대화·이름변경·삭제·클라이언트 제목 필터) + 우 메인. `lg:` 2열, 모바일은 `vaul` 드로어(패치 유지, `modal` 전달 함정). 드로어 닫힘 후 포커스 복귀.
- **상단 바**: siglens 로고 + "SiglensAI" 워드마크(메인 절대 URL), 우측에 로그인(§9-4 핸드오프 링크)/계정 설정(메인 절대 URL)/로그아웃. **모델 선택 없음**(파일럿 고정, P3에서 `ModelSelect` 재사용). 헤더 높이·토큰은 siglens `Header`와 동일(`h-14`, Trust Blue/Slate, Geist+Pretendard).
- **MessageList**: `AgentMarkdown`. assistant 아래 ToolActivity 칩(`📊 get_bars_indicators AAPL 1Day · 0.4s`, 클릭 시 결과 요약). 신선 분석 진행 중엔 칩에 `약 N초` + 펄스. 복사 버튼. assistant 마지막 메시지엔 **재생성**, user 마지막 메시지엔 **수정 후 재전송**. `max_tokens` 종료 시 "답변이 잘렸습니다" 배너. 트랜스크립트 영역 `aria-live="polite"`. 메시지별 모델 표시는 단일 모델이라 생략.
- **Composer**: 자동 높이, Enter 전송·Shift+Enter 줄바꿈, 4,000자 카운터, 잔여 턴, 중단 버튼, iOS 키보드 대응(`100dvh`·visual viewport·safe-area), 스트리밍 중 스크롤 앵커링(사용자가 위로 올리면 자동 스크롤 중지).
- **에러**: 인라인 배너(코드별 문구: turn_limit·server_busy·deadline·aborted·server_error) + 재시도 버튼(= regenerate, 턴 소비). `aborted` 행은 그대로 두고 재생성으로 대체.
- **EmptyState/랜딩**: 추천 프롬프트 6개(로케일별).
- 디자인 규약(R11): siglens와 같은 톤 — `docs/conventions/DESIGN.md` 토큰·`SURFACE_CARD`·`HEADING_SECTION`·`border-control`·포커스 링, 다크/라이트 두 테마, 메인 컬럼 `max-w-3xl`. 별도 브랜드 색 도입 금지. 구현 시 `frontend-design → web-design-guidelines → seo-audit`, `vercel-react-best-practices → next-cache-components`.

### 9-3. i18n

`scripts/i18n/extract.mjs`는 `APP='src/app/[locale]'` 고정이라 `src/app/ai/**` 키를 못 본다 → 로케일 루트 배열로 일반화하고 `routeLayout`/`RouteMessages`/`clientKeyCoverage` 테스트도 같은 목록을 읽게 한다.
ai 레이아웃의 `NextIntlClientProvider` 네임스페이스는 명시 목록(`widgets.agent-chat`, `features.agent-chat`, `app.ai`, `shared.ui`). 추출은 `yarn i18n:extract --write --apply --only <dir>`.

---

## 10. 비용 모델 (2026-09-11 공식 가격)

### 10-1. 단가(USD / 1M 토큰)

| 모델 | 입력(미스) | 입력(캐시 히트) | 캐시 쓰기 | 출력 | 출처 |
|---|---|---|---|---|---|
| deepseek-flash peak / off-peak | 0.30 / 0.15 | 0.006 / 0.003 | — | 1.20 / 0.60 | api-docs.deepseek.com |
| deepseek-v4.1-pro (api `deepseek-v4-pro`) peak | 1.32 | 0.044 | — | 3.96 | 동일 |
| gpt-5.6-luna | 0.20 | 0.02 | — | 1.20 | developers.openai.com |
| gemini-3.5-flash-lite | 0.30 | 0.03(+저장비) | — | 2.50 | ai.google.dev |
| claude-haiku-4-5 | 1.00 | 0.10 | 1.25 | 5.00 | platform.claude.com |
| claude-sonnet-5 | 2.00 | 0.20 | 2.50 | 10.00 | 동일 |

### 10-2. 턴당 비용 — 기본 vs 비관

기본: 호출 2.5회, 호출당 캐시 prefix 7k(70% 히트)·신규 3k·출력 0.4k → 턴당 캐시 17.5k·미스 7.5k·출력 1k.
비관: 호출 4회(p90; 하드 상한 6은 알람으로 감시), 툴 결과 5개(각 1.2k)가 누적, 히트 60%, 출력 2k → 턴당 미스 ~20k·캐시 ~20k·출력 2k. Claude 두 행은 5분 캐시 TTL 때문에 200턴/일 밀도에서 히트가 거의 없다고 보고 **전량 미스(40k)** 로 계산한다(쓰기 프리미엄은 히트가 없으면 발생하지 않음).

| 모델 | 기본/턴 | 비관/턴 | 200턴/일 기본 → 비관(월) |
|---|---|---|---|
| deepseek-flash peak | $0.0036 | $0.0079 | **$21 → $47** |
| gpt-5.6-luna | $0.0031 | $0.0068 | $18 → $41 |
| claude-haiku-4-5 | $0.014 | $0.050 | $86 → $300 |
| claude-sonnet-5 | $0.029 | $0.100 | $171 → $600 |

기준 — 현재 SEO 프리웜: CloudWatch `[Usage]` 실측 하루 5~6천 호출·입력 5.4k·출력 1.46k, 히트 36~66%. DeepSeek peak 기준 하루 $8~12, **월 $250~350 규모**(로그 역산 추정).
기본 모델 200턴/일은 현재 AI 지출의 7~15%. 인프라 증분 0.

### 10-3. 상한 설계

- 회원 모델(Sonnet 5 등) 비관 $0.10/턴: member 10턴/일 = $1/일, pro 20턴/일 = $2/일. 활성 회원 100명이 매일 상한까지 써야 월 $3,000(member)~$6,000(pro) — 현실 사용률은 그 수십 분의 일이고 pro 라이선스는 현재 미운영. **알람(1M 출력 토큰/일 ≈ Sonnet 500턴 ≈ $50/일) + 킬 스위치**(§12)가 최후 방어.
- 신선 분석: 회당 $0.003~0.01. FMP 예산은 **계측되지 않는다**(`addFmpBudget`은 프리웜 모니터링용이고 상한 비교 없음). 방어는 턴당 심볼 3개·일일 신선 분석 한도·60초 봉 캐시. KR 심볼은 Yahoo 비공식 경로라 같은 상한이 IP 차단 방지책이기도 하다.
- Brave: 전역 일 33·월 1,000이 무료 크레딧 안에서 $0에 고정. 회원 일 5 × 100명이면 하루 상한에 금방 닿으므로 검색은 "있으면 좋은" 보조 툴로 취급하고, 수요가 확인되면 유료 전환(월 $5/1k)을 결정한다.
- Neon 저장 +MB, Upstash 명령 +수만/일(무료 범위), EC2 동일. ASG 2대 시 +$30/월.

---

## 11. 인프라·배포·운영 체크리스트

1. **Cloudflare**: Zero Trust → Tunnels → siglens 터널 → Public Hostname `ai.siglens.io` → `http://localhost:3000`(토큰 원격 관리, `user-data.sh` 무변경, CNAME 자동, Universal SSL). Rate Limiting 규칙 1개 `/api/ai/*`. 존 전역 캐시 룰은 `dynamic` 페이지엔 무해, SSE는 `/api`라 면제.
2. **env**: `AI_SITE_URL=https://ai.siglens.io`(핸드오프·301 대상), `NEXT_PUBLIC_AI_SITE_URL` 동일. OAuth 콘솔 변경 없음.
3. **SSM**: `/siglens/BRAVE_SEARCH_API_KEY`(선택), `/siglens/AI_SITE_URL`. `check-env.sh`의 `OPTIONAL_KEYS`에 BRAVE 키 등록.
4. **알람**(`07-alarms.sh`): `[agent-stream] failed` 1시간 10건, `[agent] quota store unavailable`(core `createCounterStore`가 closed 정책 실패 시 찍는 마커) 1시간 3건, 일일 에이전트 출력 토큰 1M 초과(`[Usage]` 라인을 순수 JSON `{tag:'[Usage]',…}`으로 바꿔 JSON 메트릭 필터 사용). 전부 `defaultValue=0`.
5. **킬 스위치**: SSM `/siglens/AGENT_CHAT_DISABLED=1` → 라우트 503 + 페이지에 점검 안내. 재배포 없이 인스턴스 env 리프레시(기존 `ISR_CACHE_DISABLED`와 같은 경로).
6. **배포 순서**: core 1.1.0 태그 push → tarball 실물 확인 → siglens bump → `yarn db:migrate`(운영 Neon, target 로그 확인) → `v*` 태그. hostname·OAuth URI는 태그 전 완료.
7. **롤백**: 테이블 추가만이라 마이그레이션 되돌림 불필요. Cloudflare hostname은 코드 롤백에 안 따라오므로 구 빌드에선 ai 호스트가 메인 사이트를 그대로 보여준다(무해). 쿠키 변경 없음.
8. **dev**: `ai.localhost:3000`.

---

## 12. 관측

- `[Usage]` `jobId:'agent'` — 기존 Insights 쿼리에 합산.
- `[Agent]` 턴당 1건: `{conversationId, userId, model, steps, toolCalls:[{name,ms,status}](tool_end 이벤트에서 수집), promptVersion, ms, stopReason}`.
- 대시보드 쿼리(문서): 일별 턴·모델 분포·툴별 실패율·신선 분석 횟수·평균 step·폴백 비율.
- 비용 가드: 알람 1M 출력 토큰/일(기본 모델 200턴의 ~5배) + 킬 스위치(§11-5).

---

## 13. 테스트 (커버리지 90%)

| 층 | 방법 |
|---|---|
| core `runAgentTurn` | 스크립트형 fake provider: 툴 0회·1회·병렬 2회·8회 초과·invalid args·timeout·429 환불·abort. 순수 함수 단위 테스트(`selectHistoryWindow`, `validateArgs`, 프롬프트 스냅샷) |
| 어댑터 2종 | **프로브 실측 wire 픽스처**(§14-B)로 스트림 파서·되돌림 조립. 손으로 만든 픽스처 금지. `withAgentCacheBreakpoints` 블록 content 케이스 |
| 툴 실행기 | 소스 함수 mock, 절단·메타·에러 매핑, KR 심볼 세션 스펙 분기, `degraded`/빈 결과 표현 |
| SSE 라우트 | `FakeChatProvider`를 툴 스크립트 지원으로 확장. 이벤트 순서·heartbeat·abort 시 감소·락 해제·401/403/404·한도·fail-closed |
| 리포지토리 | 기존 `portfolio/__tests__/api.test.ts`처럼 drizzle 체인 mock. `appendMessages` 단일 INSERT…SELECT의 SQL 파라미터·`deleteFromSeq`·`supersedeAfterLastUser` |
| proxy | 호스트 분기·`/ai` 301·robots·CSP 헤더·예약어 동기화 |
| i18n | ai 레이아웃 명시 네임스페이스 목록이 위젯의 `useTranslations` 네임스페이스와 일치하는지 단위 테스트(`clientKeyCoverage` 확장은 P3) |
| e2e | `agent-chat.spec.ts`: 메인 로그인 → ai 호스트 자동 SSO → 대화 → 툴 칩 → 재생성 → 대화 목록 복귀 → 비로그인 401 → `/ai` 301. FMP 키 없음 전제, `web_search`는 `isE2E()`로 제외, KR 심볼 미사용(Yahoo fake 없음) |
| 실증 | `ai.localhost` Chrome + 배포 후 curl SSE·브라우저 4턴·Rate Limiting 동작 확인 |

---

## 14. 조사 로그

### A. 코드 실측 (siglens `37b486ed0`, core `1.0.4`)

- 챗 파이프라인: `chatAction.ts` → core `requestChatCompletion` → `callAiProviderRouter` → 4 어댑터. 포트 `CallAiProvider`는 `Promise<string>`.
- 티어·한도: core `domain/tier.ts`, `enableTierRestrictions:false`, `checkChatbotLimit`는 플래그 off면 true. `tokenStore.ts` `CHAT_TOKEN_LIMIT=5`. `hashUsageIp`는 **UTC** 날짜 버킷.
- 모델 스펙: `modelSpecs.ts`(키 `deepseek-v4.1-flash` ↔ apiModelId `deepseek-flash`, Sonnet 5는 thinking이 max_tokens 공유, haiku `toggleable:false`).
- SSE: `heartbeatStream(work: Promise)`는 `open/heartbeat/done/error` 4프레임 고정, `cancel()`은 감소 안 함(서버 작업 기준). `activeStreams.ts` 24, `STREAM_DEADLINE_MS=600_000`, `instrumentation.node.ts` drain 180초. 클라이언트 `useAnalysisStream` fetch+reader 파서.
- 게이트: `resolveTierAndByok(userId, modelId, locale)` → `{allowed, tier, userApiKey?}`; 서버 키는 `chatAction.ts`의 `getServerPrimaryKey`. `resolvePositionBucket(tier, avgPrice, currentPrice)`.
- 데이터: `schema.ts` 25 테이블. `searchTicker`(배럴 미노출), `fetchOptionsSnapshot`(배럴이 서버 전용 의도적 제외), `getCalendarFromDb(anchorEt, country, locale)`, `getCongressTradesResilient → {trades, degraded}`, `getCachedMarketDataProvider(session)` 기본 US·KR은 Yahoo(`sessionSpecFor`). core `peekAnalysisCache(symbol, tf, fmp?, modelId?, reasoning?, tier, cfg, positionBucket?)`, `peekOverallAnalysisCache`는 modelId 없으면 null. peek은 technical·overall·briefing·macro만.
- oxlint: `features/**` → entity `api|model|lib|ui` 딥 import 금지, app 레이어는 예외.
- 라우팅: `proxy.ts` rewrite·`RESERVED_FIRST_SEGMENTS`·심볼 대문자 301(`'ai'`도 심볼 형태), matcher가 `.txt/.xml/api` 제외. `app/layout.tsx` 패스스루, `[locale]/layout.tsx` `<html>`. `proxy.test.ts`는 `src/app/[locale]`만 스캔.
- 인증: 쿠키 `siglens_session` host-only, `secure` 기본 true(로컬은 호출자 override), `sanitizeNextPath` 경로 전용(OAuth 콜백에서 뚫렸던 이력 주석). `getOAuthRedirectBaseUrl()`은 `OAUTH_REDIRECT_BASE_URL ?? NEXT_PUBLIC_SITE_URL` 고정. trader 쿠키 `trader_session`, 호스트 `trader.siglens.io`·`auto-trade.siglens.io`(별도 DB).
- i18n: `extract.mjs` `APP='src/app/[locale]'` 고정, `routeClientPaths` 미등록 라우트는 chrome 네임스페이스로 폴백(키 원문 노출 사례 5,184건 주석).
- 인프라: cloudflared 토큰 실행, EC2 t4g.medium 1대(컨테이너 2.5GB·힙 1536MiB), ASG min1/max4, `-p 3000:3000`. `CDN_CACHING.md` R1/R2/W3 전부 `/api` 제외, Rate Limiting 규칙 없음. `check-env.sh`는 `.env.example` 키를 `OPTIONAL_KEYS` 제외 전부 필수로 수집. `addFmpBudget`은 모니터링용(상한 비교 없음). 크론은 `kr-tickers`·`seo-prewarm`뿐.
- CSP: `frame-ancestors 'none'`만. `MarkdownText`는 `img`·`a` 기본 렌더.

### B. 실키 프로브 (2026-09-11, `scratchpad/probe/*.mjs`, 각 수백 토큰)

1. DeepSeek `deepseek-flash` stream: thinking off → `finish_reason:'tool_calls'`, `get_quote({"symbol":"AAPL"})` 907ms; 되돌림 후 한국어 답변, `prompt_cache_hit_tokens:128`. thinking on → 성공, `reasoning_tokens:14`, 히트 256.
2. Anthropic `claude-haiku-4-5-20251001` `messages.stream` + tools `cache_control`: `stop_reason:'tool_use'`, `input_json_delta` 4건, 1,437ms; `tool_result` 후 `end_turn`.
3. OpenAI `gpt-5.6-luna` Responses `strict:true` stream: `function_call_arguments.delta` 6건, 3,193ms; `function_call_output` 후 답변.
4. Gemini `gemini-3.5-flash-lite` `generateContentStream` `thinkingLevel:'minimal'`: `functionCall{name,args,id}` 940ms; `functionResponse` 후 답변.

### C. 공식 문서 (WebFetch 인용)

- DeepSeek: "for requests carrying the `tools` parameter, the `reasoning_content` must be fully passed back to the API in all subsequent requests". strict는 `/beta` base_url. 가격 §10-1.
- Anthropic: Haiku 4.5 $1/$5, Sonnet 5 $2/$10(도입가 확정), 캐시 읽기 0.1x·쓰기 1.25x(5분), tool use 시스템 오버헤드 Haiku 496토큰, web search $10/1k.
- OpenAI: luna $0.20/$0.02/$1.20, terra $2/$0.2/$12, sol $4/$0.4/$20, astra $10/$1/$50, web search $10/1k.
- Gemini: 3.5 Flash-Lite $0.30/$2.50, 3.6~3.8 Flash $0.75/$3.75(2026-12-31까지), 3.1 Pro $2/$12, grounding 월 5,000회 무료 후 $14/1k.
- Brave Search API: $5/1k, 월 $5 무료 크레딧, 50 qps. Tavily 무료 1,000크레딧/월.
- Cloudflare Rate Limiting(무료): 규칙 1개, 창 10초, IP 기준, 완화 10초.

### D. 메모리(과거 실측)

SSE 600초 완주·침묵 61초 절단(ALB 시절), 프리웜 5~6천 호출/일·입력 5.4k·출력 1.46k·히트 36~66%, AWS 월 ~$127, Upstash 도쿄 35ms, vaul 패치, `i18n:extract --write`, 메트릭 필터 `defaultValue=0`, FMP 키 없는 E2E, `mock.calls[0]` 금지, 픽스처는 실제 shape, 마감 10분 vs drain 180초 의도적 불일치.

---

## 15. 구현 단계

| 단계 | 내용 | 산출 |
|---|---|---|
| **P-1 스파이크** | §16-1·16-2·16-3 검증(형제 `<html>` 빌드, Host 보존, 서버 액션 origin). 실패 시 §2-2 대안으로 재계획 | go/no-go |
| P0 core | 포트·`NormalizedUsage` 이동·툴 스키마·프롬프트·`selectHistoryWindow`·`runAgentTurn`·`AGENT_LIMITS`·`dailyCounterStore` + 테스트 | core 1.1.0 |
| P1 siglens 골격 | DeepSeek 어댑터·라우터(모델 고정), 툴 7종(검색·시세·봉/지표·캐시 분석·뉴스·옵션·포트폴리오), SSE 라우트·writer, proxy 호스트 분기·CSP·robots·sitemap 404, `app/ai` 레이아웃·페이지, 마이그레이션 0035·리포지토리·사이드바, SSO 핸드오프, Cloudflare hostname·Rate Limiting | **ai.siglens.io에서 회원이 SSO로 대화·저장** |
| P2 완성 | `run_fresh_analysis`(세마포어·진행 표시), `web_search`(Brave·전역 상한·SSM), regenerate/edit, `/privacy` 개정, 알람·킬 스위치, e2e | 요구사항 R1~R8 충족 |
| P3 확장 | 모델 선택 UI(`ModelSelect`, tier 하이드레이션 대기) + Anthropic(폴백)·OpenAI·Gemini 어댑터, 추론 토글 + `provider_meta` 컬럼, 요약 압축, LLM 제목, `clientKeyCoverage` ai 루트 | |
| P4 툴 확장 | asset_info·earnings·financials·market_overview·economic_calendar·congress | |

## 16. 구현 전 검증 (P-1)

1. `app/ai/[locale]/layout.tsx`의 `<html>`이 `next build`(standalone)에서 통과하는지. 실패 시 `app/(site)/[locale]`·`app/(ai)/[locale]` 다중 루트 레이아웃(102개 import 경로 수정 동반).
2. cloudflared가 `Host: ai.siglens.io`를 보존하는지(기본 동작) — 임시 로그로 확인, 아니면 `x-forwarded-host`.
3. ai 호스트에서 서버 액션 Origin/Host 검사 통과.
4. (P3) DeepSeek `deepseek-v4.1-pro`의 9/14 이후 툴 콜 재프로브 — 파일럿은 flash 고정이라 1차 무관.
5. (P3) Gemini 병렬 functionCall `id` 매칭.

§16-2·16-3은 Task 15 프로덕션 검증(curl로 CSP 헤더 확인 = Host 라우팅, 사이드바 이름변경/삭제 = 서버 액션)으로 확인한다.

## 17. v1 → v2 리뷰 반영 요약

반영(수정): 확인 게이트 폐기·자동 실행(R4) / 회원 전용 / 쿠키 도메인 확장 폐기·호스트별 로그인 / `heartbeatStream` 재사용 불가 → 전용 writer / 툴 실행기 app 레이어 / `provider_meta`·요약 압축·추론 토글 P3로 / 타임아웃 300·마감 600 / fail-closed / CF Rate Limiting·CSP·img 차단 / 절단 규칙 단일화 / seq 트랜잭션 / 동시 턴 Redis 락 / activeStreams 직접 등록·중첩 카운트 / abort 의미 명시 / 소유권 검증 명시 / 비용 비관치·Brave 산술·캐시 쓰기 / 알람 1M·킬 스위치 / KR 세션 스펙 / peek 시그니처·6탭 커버리지 / `NormalizedUsage` 이동 / `isAdmissibleSymbolShape`는 siglens / proxy 순서·예약어·테스트 범위 / robots / i18n 루트 / `OPTIONAL_KEYS` / OAuth redirect base / regenerate·edit·복사·a11y·모바일 / 개인정보 고지 / 롤백 노트 / 툴 8종으로 축소 / 폴백 프로바이더.
미반영(의도적): 보관 기간 만료용 파기 크론(회원 삭제는 즉시 하드 삭제, 탈퇴는 users cascade라 별도 크론 불필요) / LLM 제목·요약 압축(P3) / `siglens.io/ai` 경로 대안(사용자 요구가 서브도메인) / 비회원 지원(2차 검토) / FMP 예산 계측(계측기 자체가 없음, 심볼·일일 상한으로 대체).

구현 계획(2026-09-12, `docs/superpowers/plans/2026-09-12-ai-agent-chat-{core,siglens}.md`)에서 확정한 편차 2건: (1) `tokenStore` 리팩터 생략 — 기존 키가 날짜 버킷 없는 롤링 24h 형식이라 계약이 바뀜, 새 `createCounterStore`만 추가. (2) i18n 추출기 `APP` 루트 일반화 대신 ai 레이아웃이 클라이언트 네임스페이스를 명시 목록으로 주입(`--only src/app/ai`·`src/widgets/agent-chat`로 추출은 동일).

v2.2(2026-09-12) 반영 — 사용자 요구: SSO 핸드오프(R10), 포트폴리오 툴 1차(R9), 제품명 SiglensAI(R11), DeepSeek flash 고정·추론 차단·모델 UI 없음(R12), siglens 톤(R11). 계획 교차 검토 13건: neon-http 트랜잭션 없음 → 단일 INSERT…SELECT / 이력 slice 규칙 / `peekAnalysisCache`는 `{result}` / 뉴스 카테고리 sentinel 매핑·localized 제목 / proxy 기존 테스트 `headers` / `AnalysisHistoryTab` 좁히기 / quota store 로그 마커 / `[Usage]` 순수 JSON / writer 에러 코드 / `intermediate` 필드명 / `remaining`은 done 프레임 / sitemap ai 404 / 스캔 확장 대신 명시 단언.

v2 재검증(15건) 반영: robots는 proxy가 직접 응답(메인 robots 무변경) / 신선 분석엔 abort 시그널 미전달(dedupeInFlight 공유) / 로그인 링크 ai 호스트 상대 경로 + 인증 페이지 ai 서브트리 re-export / `resolveMarketProfile → sessionSpecFor(profile)` / Brave 일 33·회원 5 / Claude 비관치 전량 미스로 재계산 / pro 회원모델 20·동시 턴 1 / 인스턴스당 상한 명시 / proxy 테스트 명시 단언 / `superseded` 상태 / `availableTools` 주입 / 카운터 failurePolicy / `registerActiveStream` 계약 / ModelId 표기 통일 / sitemap ai 호스트 404.
