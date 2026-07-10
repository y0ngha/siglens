# DeepSeek 프로바이더 추가 및 기본 모델 전환 — 설계

- 작성일: 2026-07-10
- 범위: `siglens-core`, `siglens-worker`, `siglens` (3개 레포)
- 목표: 기존 gemini/openai/claude에 **DeepSeek V4** 프로바이더를 추가하고, 정상 동작을 실증한 뒤 **DeepSeek을 기본 모델로 전환**한다.

---

## 1. 요구사항 (확정)

1. DeepSeek V4 **2종**을 추가한다: `deepseek-v4-flash`, `deepseek-v4-pro`.
2. 세 레포 모두 수정한다.
3. 정상 동작을 **실증**(분석·briefing·chat end-to-end)한 뒤 진행한다.
4. **기본 모델 = `deepseek-v4-flash`** (non-thinking). 분석/뉴스/chat/briefing 전부 DeepSeek 기본.
5. `deepseek-v4-pro`는 상위 품질(thinking) 모델. **BYOK 없이 서버 키로** 사용 가능해야 한다.

### 확정된 제품 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 기본 모델 | `deepseek-v4-flash`, non-thinking | 저가·저지연, 기존 `gemini-2.5-flash-lite` 기본값 대체 |
| pro thinking | `deepseek-v4-pro` = thinking on(reasoning) | flash/pro 품질 차별화 |
| tier 배치 | flash + pro **둘 다 FREE_MODELS** | 게이팅 비활성(`enableTierRestrictions:false`) 상태에서 BYOK 없이 서버 키로 즉시 동작. premium 모델은 게이팅 무관하게 non-pro에 BYOK를 요구하므로, pro를 free에 두어야 "회원이 BYOK 없이" 요구를 충족. **게이팅 도입 시 pro를 member 전용으로 이동**은 별도 향후 작업 |
| Briefing(market/economy) | DeepSeek으로 전환 | "모두 deepseek" — 현재 gemini 하드코딩을 provider 일반화 |
| 번역(koreanTranslator) | gemini 유지 | 분석/chat 범위 밖 유틸(gemini 직접호출), 이번 범위 제외 |

---

## 2. DeepSeek API 계약 (검증됨)

- OpenAI 호환 `POST /chat/completions`, `baseURL: https://api.deepseek.com` → 기존 `openai` SDK 재사용(새 의존성 0).
- 모델 ID: `deepseek-v4-flash`, `deepseek-v4-pro` (1M 컨텍스트, 384K max output). 레거시 `deepseek-chat/reasoner`는 2026-07-24 폐기 → 사용 안 함.
- **JSON 출력**: `response_format: { type: 'json_object' }` 만 지원(OpenAI식 `json_schema` strict 미지원). 프롬프트에 'json'과 출력 예시 필요.
- **thinking 토글**(top-level body 필드):
  - 활성: `thinking: { type: 'enabled' }` (옵션 `reasoning_effort: 'high' | 'max'` **를 thinking 객체 안에 중첩**)
  - 비활성: `thinking: { type: 'disabled' }`
- `max_tokens`, `temperature`(기본 1, ≤2) 지원.
- 주의: json_object 모드에서 **간헐적 빈 응답** 가능(공식 문서 명시) → retry 래퍼로 흡수.

---

## 3. 어댑터 전략 (선택: A)

**A. 전용 DeepSeek 어댑터 신설** — `openai` SDK를 `baseURL`로 재사용, `chat.completions.create` + `json_object` + thinking 토글.

- 선택 이유: "provider당 파일 하나" 기존 패턴 준수, 새 의존성 없음, DeepSeek 고유 계약(json_object/thinking)을 chatgpt(Responses API/json_schema)와 격리 → 회귀 위험 최소.
- 기각: (B) chatgpt 어댑터 baseURL 분기 공유 → Responses↔chat.completions·json_schema↔json_object 분기 지옥. (C) 별도 deepseek SDK → 불필요한 의존성.

---

## 4. ModelSpec 설계 (core)

DeepSeek는 토글 기반이므로 **단일 `DeepSeekModelSpec` variant + `thinking: boolean`** 로 모델링.

```ts
export interface DeepSeekModelSpec extends BaseModelSpec {
    provider: 'deepseek';
    thinking: boolean;      // true → thinking:{type:'enabled'}, false → {type:'disabled'}
    temperature: number;    // non-thinking 모드에서 SDK 호출자가 적용
    effort?: undefined;     // DeepSeek는 effort 대신 thinking 토글 사용
    thinkingBudget?: undefined;
}
```

- `ModelSpec` union에 추가. `effort === undefined` 이므로 `isSamplingModelSpec` 반환 타입에 `DeepSeekModelSpec` 포함(런타임 true 정합). **가드는 core/worker/siglens에서 실제 호출되지 않고 re-export만 되므로 widening은 회귀 없음**(검증됨).
- `MODEL_SPECS` 2행 (maxOutputTokens = 393_216 = 384×1024, DeepSeek V4 최대 출력):
  - `deepseek-v4-flash`: `{ provider:'deepseek', apiModelId:'deepseek-v4-flash', maxOutputTokens:393_216, thinking:false, temperature:0 }`
  - `deepseek-v4-pro`: `{ provider:'deepseek', apiModelId:'deepseek-v4-pro', maxOutputTokens:393_216, thinking:true, temperature:0 }`
- `DeepSeekModelId` 매핑 타입 + `isDeepSeekModel` 가드. `getProvider`는 자동 동작.

---

## 5. 레포별 변경

### 5.1 `siglens-core` (먼저 구현·릴리스 — single source of truth)

| 파일 | 변경 |
|---|---|
| `domain/types.ts` | `AIProvider += 'deepseek'`; `LlmProvider += 'deepseek'`; `DeepSeekModelSpec` 신설 + `ModelSpec` union 추가; `isSamplingModelSpec` 반환타입 확장; `TierModel += 'deepseek-v4-flash' \| 'deepseek-v4-pro'` |
| `domain/analysis/modelSpecs.ts` | `MODEL_SPECS` 2행; `DeepSeekModelId` 타입; `isDeepSeekModel` 가드 |
| `domain/llm/providers.ts` | `AI_PROVIDER_TO_LLM_PROVIDER.deepseek = 'deepseek'`; `getProviderForModel`에 `deepseek-` prefix 분기 |
| `domain/tier.ts` | `FREE_MODELS += 'deepseek-v4-flash', 'deepseek-v4-pro'` (member/pro는 상속). `requiresByokKey` 정책 불변 |
| `application/chat/constants.ts` | `DEEPSEEK_V4_FLASH_MODEL='deepseek-v4-flash'`, `DEEPSEEK_V4_PRO_MODEL='deepseek-v4-pro'` 추가 |
| `application/chat/requestChatCompletion.ts:273` | 기본값 `?? GEMINI_2_5_FLASH_MODEL` → `?? DEEPSEEK_V4_FLASH_MODEL` |
| `infrastructure/cache/config.ts:155` | `BRIEFING_MODEL_ID = 'deepseek-v4-flash'` |
| `index.ts` / `index.client.ts` | `isDeepSeekModel`, `DeepSeekModelId`, `DeepSeekModelSpec`, `DEEPSEEK_V4_FLASH_MODEL`, `DEEPSEEK_V4_PRO_MODEL` export |
| 테스트 | `modelSpecs.test`(exact-set 13개로), `providers.test`(deepseek 매핑/prefix), `tier.test`(free 목록), `index(.client).test`(export) 갱신 + DeepSeek 케이스 |

→ **PR → review-agent → 승인 → main 병합 → `yarn release`(v* 태그) → GitHub Packages publish**

### 5.2 `siglens-worker` (core dep bump 후)

| 파일 | 변경 |
|---|---|
| `src/deepseek.ts` (신규) | `openai` SDK, `baseURL:'https://api.deepseek.com'`, per-apiKey clientCache, `chat.completions.create` + `response_format:{type:'json_object'}` + `spec.thinking` 토글(+pro `reasoning_effort:'high'` 중첩) + `spec.temperature`(non-thinking) + `max_tokens=spec.maxOutputTokens`. system/schema는 프롬프트에 반영 |
| `src/deepseek-retry.ts` (신규) | `chatgpt-retry.ts` 미러 |
| `src/index.ts` | `callAnalysisAI` dispatch에 `isDeepSeekModel` 분기; `resolveServerApiKey`에 deepseek 분기 |
| `src/index.ts` briefing | `processBriefingJob`가 provider 분기(deepseek 허용) |
| `src/briefing-model.ts` | `resolveBriefingModel`의 gemini-only 가드 완화 → deepseek 허용 |
| `src/config.ts` | `BriefingAIProviderType`에 deepseek; `DEEPSEEK_API_KEY` requireEnv + `config.deepseek`; briefing 기본 모델을 deepseek-v4-flash로 |
| `src/usage.ts` | `extractDeepSeekUsage`(OpenAI usage shape 재사용) |
| `src/models.ts` | `isDeepSeekModel` 등 재export |
| `.env.yaml(.example)` + Cloud Run secret | `DEEPSEEK_API_KEY` |
| 테스트 | `index.test`(dispatch), `models.test`, `usage.test`, `deepseek(.retry).test`, `briefing-model.test` |

→ PR → 릴리스

### 5.3 `siglens` (core dep bump 후)

| 파일 | 변경 |
|---|---|
| `src/entities/llm-provider/api/deepseek.ts` (신규) | `callDeepseekChat(opts: CallAiProviderOptions)` — worker 어댑터와 동일 계약 |
| `src/entities/llm-provider/index.ts` | `callDeepseekChat` export |
| `src/entities/llm-provider/api/router.ts` | `case 'deepseek': return callDeepseekChat(apiOptions)` (never 가드 해소) |
| `src/entities/chat-message/actions/chatAction.ts` | `case 'deepseek': return process.env.DEEPSEEK_CHAT_API_KEY` (never 가드 해소) |
| `src/entities/llm-provider/lib/providerDefaults.ts` | `DEEPSEEK_MODEL_PRIORITY` + `PROVIDER_PRIORITY_MAP.deepseek` |
| `src/shared/config/llmProviders.ts` | `LLM_PROVIDER_VALUES += 'deepseek'` |
| `src/entities/api-key/lib/constants.ts` | `AI_PROVIDER_VALUES += 'deepseek'` (exhaustiveness 가드 해소) |
| DB 마이그레이션 | `drizzle/`에 `ALTER TYPE llm_provider ADD VALUE 'deepseek'`; `schema.ts` pgEnum 반영 |
| UI 라벨 | `ModelSelector.tsx`/`ChatPanel.tsx` display map; `llmProviderLabels.ts`/`ApiKeySection.tsx`/`UserApiKeyRequiredModal.tsx`의 `Record<LlmProvider>`(컴파일 강제) |
| **기본값 전환** | `useSelectedModel.ts:16` `DEFAULT_MODEL`; `app/[symbol]/page.tsx:209`; `app/[symbol]/overall/page.tsx:133,140`; `useChat.ts:108` → **모두 deepseek-v4-flash** |
| `.env.*` | `DEEPSEEK_CHAT_API_KEY` |
| 테스트 | `llmProviders`, `llmProviderLabels`, `db/constants`, `router`, `providerDefaults`, `chatAction`, `apiKey`, 통합/worst-case, `ModelSelector`/`ModelSelect` 갱신 |

→ PR → 릴리스

---

## 6. 데이터 흐름 (전환 후)

```
[분석 탭 / 뉴스 탭]  useSelectedModel(DEFAULT=deepseek-v4-flash)
      → submit*Analysis({ model: deepseek-v4-flash })
      → worker /analyze → isDeepSeekModel → callDeepseekWithRetry(server DEEPSEEK_API_KEY)

[Chat]  useChat(default=deepseek-v4-flash) 또는 localStorage
      → requestChatCompletion → router → callDeepseekChat(DEEPSEEK_CHAT_API_KEY)

[Briefing(market/economy)]  BRIEFING_MODEL_ID=deepseek-v4-flash
      → worker /briefing → provider 분기 → callDeepseekWithRetry
```

- 뉴스 분석은 기본값을 상속하므로 **자동** DeepSeek 적용.
- SSR 캐시 키가 기본 모델을 포함 → **배포 직후 전 심볼 cold-gen 1회**(기존 gemini 캐시 무효화, 의도된 동작).

---

## 7. 에러 처리 / 엣지

- json_object 간헐 빈 응답 → deepseek-retry가 재시도, worker `normalizeJsonResponse`+`jsonrepair`가 보정.
- 스키마 strict 미지원 → 분석 프롬프트가 이미 출력 형식을 기술(gemini/claude와 동일 경로)하므로 프롬프트 의존으로 충분. 실증에서 스키마 준수 확인.
- 서버 키 부재 시 기존 `server_error` 경로 그대로.

---

## 8. 검증 (릴리스 전 로컬 실증)

1. 각 레포 스코프 게이트: `tsc` + 스코프 테스트 + lint. review-agent 통과.
2. **cross-repo 로컬 오버레이**: core 빌드를 worker/siglens `node_modules/@y0ngha/siglens-core`에 오버레이 → 실제 `DEEPSEEK_API_KEY`로:
   - 분석 1건(심볼 분석) — DeepSeek 응답·스키마 준수 확인
   - briefing 1건(market) — DeepSeek 경로 확인
   - chat 1건 — DeepSeek 응답 확인
3. 통과 후 **core 정식 릴리스 → worker bump·릴리스 → siglens bump**. 배포 검증은 curl + Chrome 실측.

---

## 9. 릴리스 순서 (cross-repo)

```
core: 구현 → PR → 승인 → merge → yarn release(v*) → publish
  ↓
worker: package.json core dep bump → yarn install → 구현 → PR → 승인 → merge → release
  ↓
siglens: package.json core dep bump → yarn install → 구현(+DB 마이그레이션) → PR → 승인 → merge → 배포
```

- 규칙: **APPROVED 전 머지·릴리스 금지**. push 반영은 `ls-remote`로 검증. 커밋/PR은 git-agent.

---

## 10. 범위 밖 (명시)

- 번역(koreanTranslator) gemini 유지.
- 티어 게이팅 활성화 및 pro의 member 전용화 — 별도 향후 작업.
- 결제/tier 승급 UI — 무관.
