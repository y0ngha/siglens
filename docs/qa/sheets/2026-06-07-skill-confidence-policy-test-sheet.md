# Test Sheet — Skill Confidence Policy & usage_roles

- **작성일**: 2026-06-07
- **대상 변경**: siglens-core 0.21.0 + siglens PR #583 (머지 `091a380c`)
- **배포**: master 머지 → Vercel 자동 배포 (core 0.21.0은 GitHub Packages publish 완료)
- **스펙/플랜**: `docs/superpowers/specs/2026-06-07-skill-confidence-policy-design.md`, `docs/superpowers/plans/2026-06-07-skill-confidence-policy.md`
- **배포 감사**: SAFE TO DEPLOY (blocker 0). note = 프롬프트 캐시 self-healing(아래 R1)

> 검증 원칙: 추측 금지, 실측 기록(`docs/qa/EMPIRICAL_VERIFICATION.md`). 결정적 매처.

---

## 1. 변경면(change surface) 분석

| # | 변경면 | 입력 | 출력/동작 변화 | 사용자 노출 |
|---|---|---|---|---|
| S1 | AI 분석 프롬프트(차트/fundamental/news) | 스킬 카탈로그 | `< 0.5` 하한 필터 제거 → 더 많은 스킬 주입. `[Low/Medium/High Confidence]` 라벨 + indicator는 `[Roles: ...]` | 간접 (분석 텍스트 품질·범위) |
| S2 | 패턴/전략 결과 후처리(core `enrichAnalysisWithConfidence`) | worker 응답 | `filterPatterns` 제거 → 낮은 confidence 패턴 유지. 전략은 그대로 유지(이미 무필터) | 분석 결과의 패턴/전략 목록 |
| S3 | `AnalysisPanel.tsx` 전략 표시 | `strategyResults` | `confidenceWeight >= MIN` 필터 제거 → 낮은 confidence 전략도 표시(패턴 중복만 제외) | 종목 페이지 "전략" 섹션 |
| S4 | home `SkillsShowcase.tsx` | 스킬 목록 | tooltip 3등급 문구(‘제외’ 제거), confidence bar 3색(Low 회색/Medium 주황/High 청록) | 홈 스킬 쇼케이스 |
| S5 | 분석 진행 문구 `useAnalysisProgress.ts` | — | "와이코프" 제거 | 분석 로딩 중 문구 |
| S6 | 카탈로그 | `skills/` | `wyckoff.md` 삭제, 37개 indicator에 `usage_roles` | 스킬 수(hero/StatsBar), 전략 목록 |
| S7 | validator `validate-skills.ts` | frontmatter | `indicator_guide` `usage_roles` 필수(always_on 면제) | 빌드 게이트(CI) |

---

## 2. 잠재 오류 / 리스크 (먼저 확인)

| ID | 리스크 | 영향 | 확인 방법 |
|---|---|---|---|
| **R1** | **프롬프트 캐시 self-healing** — core `PROMPT_TEMPLATE_VERSION='p1'` 미변경 + `hashSkillCatalog`가 `usageRoles`/`confidenceWeight`/content 미해싱. **이미 분석된 warm 심볼은 분석 캐시 TTL까지 옛 프롬프트** | 테스트 시 "왜 새 라벨/패턴이 안 보이지?" 오해 가능 | **반드시 신규 심볼이거나 재분석**으로 검증. M1 참조 |
| **R2** | 하한 필터 제거로 **낮은 confidence 패턴/전략/스킬이 다수 노출** | UI가 지저분하거나 사용자 신뢰 저하 가능 | M2·M3 실측 — 노출량과 가독성 |
| **R3** | **UNMATCHED(confidenceWeight 0) 누출** — 매칭 안 된 패턴이 0 weight로 결과에 남음 | UI에 의미 없는 0% 항목 표시 가능 | 감사: home Showcase만 소비, 분석 프롬프트는 core가 빌드 → 누출 경로 없음(코드상 clean). M2에서 실측 재확인 |
| **R4** | **프롬프트 토큰 증가** — 스킬 더 주입 | 분석 지연·비용↑, 드물게 컨텍스트 한도 | M1에서 분석 소요시간 체감 + (가능하면) worker 로그 토큰 |
| **R5** | 스킬 수 변동(Wyckoff -1 전략) | hero/StatsBar 카운트 불일치 가능(이전 회귀 이력 `81988f58`) | B4 실측 |

---

## 3. 테스트 케이스

### 그룹 A — 자동 검증 (실행 완료, origin/master `091a380c` 기준)

| ID | 케이스 | 기대 | 결과 |
|---|---|---|---|
| C1 | 현재 카탈로그/UI에 와이코프 잔재 | `git grep -i wyckoff\|와이코프 -- src skills README docs/product` → 0 | ✅ PASS (0건) |
| C2 | indicator md에 `usage_roles` | `skills/indicators/*.md` 37개 모두 보유 | ✅ PASS (37/37) |
| C3 | `MIN_CONFIDENCE_WEIGHT` 런타임 참조 | `src`/`scripts`에 0 | ✅ PASS (0건) |
| C4 | `wyckoff.md` 삭제 | 트리에 없음 | ✅ PASS |
| C5 | `yarn validate:skills` | 81 skill 통과(always_on 면제 포함) | ✅ PASS (CI green) |
| C6 | 단위 테스트 | confidenceLevel/confidence/api/validate-skills/SkillsShowcase/AnalysisPanel 신규·경계 케이스 | ✅ PASS (CI 5087 tests) |
| C7 | `tsc`/`lint`/`build` (정식 0.21.0) | 0 | ✅ PASS (clean install 검증) |

### 그룹 B — 브라우저/UI 수동 (Chrome 데스크톱 기준선; Safari·모바일은 §4)

| ID | 화면 | 케이스 | 기대 | 결과 |
|---|---|---|---|---|
| B1 | 홈 Skills Showcase | confidence bar 색상 경계 | weight `<0.5`=회색(`bg-secondary-500`), `0.5~0.8`=주황(`bg-ui-warning`), `≥0.8`=청록(`bg-chart-bullish`) | ✅ PASS — Connors RSI 40%=회색, Doji/Harami 75/72%=주황, DMI/Donchian 85/80%=청록 (확대 확정) |
| B2 | 홈 Skills Showcase | ⓘ tooltip 문구 | "분석에서 제외" **없음**. "50% 미만 낮음 · 50~80% 보통 · 80% 이상 높음", "낮은 점수도 분석에 보조적으로 반영" 노출 | ✅ PASS — '제외' 없음, 3등급+보조 반영 문구 정확 |
| B3 | 홈 Skills Showcase | tooltip 퍼센트 | `50%`/`80%`로 정확 표시(80.0000…1 아님) | ✅ PASS — 50/80 정수 표시 |
| B4 | 홈 hero/StatsBar | 스킬 수 카운트 | hero 카피와 StatsBar 수치 일치(Wyckoff -1 반영, 보조지표 수 동일) | ✅ PASS — "보조지표 38종·캔들 8·차트 17·전략 8·지지저항 3" |
| B5 | 종목 페이지 분석 패널 | 전략 섹션 | 낮은 confidence 전략도 표시(패턴과 이름 중복인 것만 제외). 0%/빈 전략 junk 없음 | ⚠️ 코드/테스트 검증(C6). NVDA는 전략 카드 미감지(요약→매매전략 직결) — 다른 종목 재확인 권장 |
| B6 | 종목 분석 로딩 | 진행 문구 | "와이코프" 미등장. "엘리어트 파동, 피보나치 등…" | ✅ PASS — 진행 문구 3종 관찰, 와이코프 미등장 |
| B7 | 스킬 목록/검색 | 전략 카탈로그 | Wyckoff 미노출 | ✅ PASS — 전략 8종, Wyckoff 없음 |

### 그룹 M — 분석 실행(End-to-End 동작) — **R1 때문에 신규/재분석 필수**

| ID | 케이스 | 절차 | 기대 | 결과 |
|---|---|---|---|---|
| M1 | 신규 심볼 기술 분석 | 평소 잘 안 보던 종목을 **새로** 분석(또는 기존 종목 **재분석** 버튼) | 분석 성공, 소요시간 정상 범위. 낮은 confidence 패턴/지표 해석도 결과에 반영 | ✅ PASS — NVDA 신규분석 ~1.5분 완료(약세). Squeeze Momentum 'ON'·Elder Impulse 'red'·Supertrend 하락 등 pro-indicator 해석 반영 |
| M2 | 낮은 confidence 항목 노출량 | M1 결과의 패턴/전략/지표 목록 점검 | 이전보다 항목 多. 그러나 **0%/무의미 junk 없음**, 가독성 유지 | ✅ PASS — 보조지표 가이드 8개+ 풍부 표시(RSI 약한/MACD 보통/CCI 강한 시그널), 0%/junk 없음, 카드 정돈 |
| M3 | fundamental/news 분석 | 재무·뉴스 탭 분석 실행 | 낮은 weight skill도 반영(category 필터만 적용), 결과 정상 | ☐ 미실행 (기술 분석으로 핵심 검증됨) |
| M4 | 캐시 경계 확인 | **이미 분석돼 있던** 심볼을 분석(재분석 X) | 옛 결과가 그대로일 수 있음(self-healing) — 이는 정상. 재분석하면 새 동작 | ☐ 미실행 (R1 self-healing 사용자 인지·수용) |

---

## 4. 누락 방지 축 (TEST_SHEET_AUTHORING §2)

| 축 | 적용 케이스 | 결과 |
|---|---|---|
| 캐싱·상태(2.5) | **R1/M1/M4 — 가장 중요**. warm vs 신규 심볼 분석, 재분석 시 새 프롬프트 반영 | ☐ |
| 길이·수량 극단(2.2) | 하한 필터 제거로 패턴/전략 **N개 많아질 때** AnalysisPanel·Showcase 레이아웃 안 깨지는지(B5/B1) | ☐ |
| 브라우저 엔진(2.3) | SkillsShowcase tooltip(`group-hover`/`usePopoverToggle`)·bar 색상 Safari(WebKit) 확인 | ☐ |
| 뷰포트 모바일(2.4) | Showcase 카드·tooltip(`w-56` 우측정렬), AnalysisPanel 전략 섹션 모바일 가로 오버플로우 | ☐ |
| 접근성(2.6) | tooltip `aria-label="신뢰도 점수 설명"`·`role="tooltip"`·`aria-describedby` 키보드 도달, bar `aria-hidden` 유지 | ☐ |
| 렌더 입력(2.1) | 분석 결과 텍스트(마크다운) 렌더 — 이번 변경은 스킬 셋만 바꿈, 렌더 경로 무변경(회귀 가드만) | ☐ |

---

## 5. 분석 실행 절차 (M 그룹 수행용)

**옵션 1 — 프로덕션(배포됨)**: `https://siglens.io`에서 평소 안 보던 종목을 새로 분석하거나, 기존 종목 **재분석**. R1 때문에 **반드시 신규/재분석**으로 새 동작 확인.

**옵션 2 — 로컬 prod-like**: `docs/qa/QA_ENV_SETUP.md`로 docker(Postgres+Redis+SRH)+`.env.local`+prod 빌드. worker 토큰 로그까지 보려면 worker 환경 필요. **prod DB 미접촉**.

**확인 포인트**:
1. 분석이 에러 없이 완료되는가(R4 지연 체감).
2. 결과 패턴/전략/지표가 이전보다 풍부하되 junk(0%/빈 항목) 없는가(R2/R3).
3. 종목 페이지 전략 섹션·홈 Showcase가 §3 B 케이스대로 보이는가.

---

## 6. 결과 요약 (실행 후 기록)

- 자동 검증(C1~C7): **7/7 PASS** (머지본·CI 기준)
- 브라우저(B1~B7): **6 PASS / 1 코드검증**(B5는 NVDA 전략 미감지로 UI 직접 미확인 — 코드/테스트 검증) — 로컬 dev(4200)+worker(8080) 실측 2026-06-07
- 분석 실행(M1~M2): **2 PASS** (NVDA 신규분석). M3·M4 미실행
- 누락축(§4): 데스크톱 Chrome 기준. Safari·모바일 미실측

> 로컬 dev 실측으로 B1~B4, B6, B7, M1, M2 모두 PASS. **추가 발견 → 같은 커밋에서 즉시 수정·재실측 완료**: ① 카드 타입 뱃지('지표'/'캔들')가 긴 제목 옆에서 세로로 뭉개짐 → `shrink-0`+`whitespace-nowrap`+제목 `min-w-0`+`items-start` ✓ ② tooltip 가운데 문장 문체 불일치(명사 나열) → 존댓말 문장형 통일 ✓ (dev 재확인).
