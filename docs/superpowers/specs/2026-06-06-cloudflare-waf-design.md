# Cloudflare WAF 봇·스크래퍼 차단 설계

**날짜:** 2026-06-06
**대상:** siglens.io (Cloudflare 무료 플랜, zone `fd33ef07a5571c39f9376d05de2de4ff`)
**적용 위치:** Cloudflare 대시보드 → Security → WAF → Custom Rules (사용자가 직접 적용)
**연관 비용:** Vercel On-Demand $109.43/사이클 중 Observability $20.87 + Fast Origin Transfer $58.55 + Fluid CPU/Memory $22 + ISR Writes $25 — 이 4개를 동시에 줄일 수 있는 단일 레버

---

## 1. 배경

### 1.1 실측 진단 (2026-06-06)

- CF 캐시율: 0.95% — origin(Vercel) 직행 트래픽이 24h 51.49k 요청 중 42.15k(82%)
- AWS 데이터센터 단일 대역이 origin 트래픽의 45% 차지 (23.2k/일):
  - `216.73.216.114` — 15.65k/일
  - `216.73.216.189` — 7.58k/일
  - ipinfo 확인: 둘 다 Amazon AWS (AS16509), Columbus Ohio (us-east-2)
- "알 수 없음/기타" 브라우저 UA: 26.33k(51%) — 비브라우저 신호
- Vietnam 17.24k 집중 — 사용자 베이스가 거의 한국이므로 스크래퍼 추정
- GoogleBot: 2.76k(5%) — Google ASN, SEO 봇, **절대 보존**

### 1.2 비용 영향

봇 트래픽이 CF에서 캐시되지 않고 Vercel까지 통과(캐시율 0.95%) → 4개 비용 동시 유발:
- Observability: 요청당 카운트, 샘플링 불가
- Function Invocations: 함수 호출당 과금
- Fluid CPU/Memory: 함수 점유 시간
- Fast Origin Transfer: CDN↔함수 데이터 전송

봇 차단 = ROI 가장 큰 단일 레버.

### 1.3 기존 상태 (2026-06-02 적용된 룰 2개)

- Rule 1: `.php` 요청 Block (PHP 스캐너 대응)
- Rule 2: 호스팅 ASN Challenge — 이 룰이 AWS 216.73.216.x를 통과시켰음

**왜 통과했나:** 기존 Rule 2의 표현식이 호스팅 ASN을 충분히 커버하지 못했거나, `cf.client.bot` (verified) 처리가 우회 경로를 만들었을 가능성. 이번 설계에서 Rule 2를 더 강력한 표현으로 교체.

---

## 2. 사용자가 확정한 요구사항

| 항목 | 결정 |
|------|------|
| 해외 사용자 대응 | 수용 가능 — 거의 한국 사용자 (Managed Challenge 통과시 정상 사용) |
| 보존해야 할 봇 | verified 검색봇 (GoogleBot/Bingbot/Naver Yeti) + AI 봇 (GPTBot/ClaudeBot/Perplexity 등) + 국내 봇 |
| 추가 차단 대상 IP | 216.73.216.0/24 (AWS 데이터센터 스크래퍼) |
| 추가 차단 대상 ASN | 13220 (Russia), 132203 (Tencent) |
| 검증 | "거의 한국" 사용자 베이스 사실로 확정 — GraphQL country 분포 검증 생략 |

---

## 3. 룰 설계

### 3.1 전체 전략

> **"한국 외 모든 트래픽은 verified bot이 아니면 Managed Challenge."**
> + **"AWS 스크래퍼 대역 / Tencent / Russia ASN은 무조건 Block."**

이 두 룰 조합은 시각화:
- 한국 사용자 → 모든 룰 무관, 정상 통과
- 한국 외 verified 검색봇/AI 봇 → Rule A 통과 (cf.client.bot 면제)
- 한국 외 일반 사용자 → Rule A에서 Managed Challenge (브라우저 JS 통과 가능)
- 한국 외 스크립트 봇/스크래퍼 → Rule A에서 Challenge 실패 → 차단
- 216.73.216.0/24 / AS13220 / AS132203 → 한국이든 verified든 무관, Rule B에서 즉시 Block

### 3.2 Rule A — "한국 외 + 미인증 봇" Managed Challenge

**Expression:**
```
(ip.geoip.country ne "KR") and (not cf.client.bot)
```

**Action:** `Managed Challenge`

**효과:**
- 한국 IP → 매치 안 됨, 통과
- 한국 외 verified bot (GoogleBot/Bingbot/Naver Yeti/AI 봇 일부 포함) → `cf.client.bot=true` → 매치 안 됨, 통과
- 한국 외 일반 브라우저 → Managed Challenge (한 번 통과하면 일정 시간 면제)
- 한국 외 스크립트 봇 → Challenge 통과 불가 → 차단

**리스크:**
- AI 봇이 CF의 verified bot 목록에 포함되지 않으면 Challenge에 막힘. 무료 플랜은 `cf.client.bot`이 GoogleBot/Bingbot/등 주요 검색 크롤러를 포함하지만, 신생 AI 봇(ClaudeBot/Perplexity)은 시점에 따라 포함/미포함이 다름. 보존이 필요하면 § 3.4 화이트리스트 추가.

### 3.3 Rule B — AWS 스크래퍼 대역 / Tencent / Russia ASN Block

**Expression:**
```
(ip.src in {216.73.216.0/24}) or (ip.geoip.asnum in {132203 13220})
```

**Action:** `Block`

**효과:**
- 216.73.216.x AWS 데이터센터 23k/일 트래픽 즉시 차단
- AS132203 (Tencent) 차단
- AS13220 (Russia) 차단
- verified bot이라도 이 IP/ASN에서 오면 차단됨 (Rule A보다 강력)

**리스크:**
- 216.73.216.0/24 안에 본인 인프라(uptime 모니터링/E2E)가 있다면 같이 막힘. 현재 알려진 본인 인프라는 Vercel/Cloudflare/UptimeRobot/외부 모니터링이며 AWS 216.73.216.x는 사용 흔적 없음. 적용 후 대시보드에서 본인 트래픽 끊김 확인.

### 3.4 (선택) AI 봇 보존 화이트리스트

GPTBot, ClaudeBot, PerplexityBot이 Rule A에 막히는 것이 확인되면 Rule A 표현식에 다음을 추가:
```
(ip.geoip.country ne "KR")
and (not cf.client.bot)
and not (
  http.user_agent contains "GPTBot"
  or http.user_agent contains "ClaudeBot"
  or http.user_agent contains "PerplexityBot"
  or http.user_agent contains "Yeti"
)
```

User-Agent 기반은 위조 가능하지만, AI 봇 트래픽 보존 가치가 위조 리스크보다 큼 (SEO·LLM training 데이터셋 노출).

### 3.5 룰 우선순위

Cloudflare Custom Rules는 위에서 아래로 평가되며 첫 매치 후 멈춤:

| 순위 | 룰 | 액션 |
|------|----|----|
| 1 | 기존 `.php` 차단 (이미 적용됨) | Block |
| 2 | Rule B — AWS/Tencent/Russia (위 § 3.3) | Block |
| 3 | Rule A — 한국 외 + 미인증 봇 (위 § 3.2) | Managed Challenge |

Block을 Challenge보다 먼저 두어, 차단 대상이 Challenge 화면을 보지 않도록 한다(불필요한 CF 무료 플랜 Challenge 카운트 절약).

---

## 4. CF 대시보드 적용 절차

> 무료 플랜 Custom Rules: 최대 5개. 현재 적용된 2개 + 신규 2개 = 4개. 여유 있음.

### Step 1: 기존 "호스팅 ASN Challenge" 룰 제거

기존 Rule 2(호스팅 ASN Challenge)는 AWS 216.73.216.x를 통과시킨 실패한 룰이므로 삭제하고 Rule B로 교체.

대시보드 경로: `siglens.io 도메인 → Security → WAF → Custom Rules` → 기존 Rule 2 우측 ··· → Delete

### Step 2: Rule B 추가 (AWS/Tencent/Russia Block)

- Rule name: `Block AWS scraper / Tencent / Russia`
- Expression Editor:
  ```
  (ip.src in {216.73.216.0/24}) or (ip.geoip.asnum in {132203 13220})
  ```
- Action: Block
- Save and Deploy

### Step 3: Rule A 추가 (Non-KR + 미인증 봇 Challenge)

- Rule name: `Challenge non-KR untrusted bots`
- Expression Editor:
  ```
  (ip.geoip.country ne "KR") and (not cf.client.bot)
  ```
- Action: Managed Challenge
- Save and Deploy

### Step 4: 룰 순서 확인

Rules 페이지에서 드래그하여 위 § 3.5 우선순위대로 정렬.

---

## 5. 검증 방법

### 5.1 즉시 (적용 직후 10분 이내)

- `siglens.io` 한국 IP로 정상 접속 → 정상 응답 (Rule A 통과 확인)
- `curl --resolve siglens.io:443:<CF_IP> https://siglens.io/` (US VPN 또는 외국 노드) → CAPTCHA 페이지 (Rule A 매치 확인)
- CF 대시보드 → Security → Events → Custom Rule 매치 로그 확인 (Rule A·B 매치 카운트 증가)

### 5.2 24시간 후

- CF 대시보드 → Analytics → Traffic → Cached vs Uncached 비교
  - 기대: Origin(Vercel) 직행 트래픽 51k → 약 25k 이하로 감소 (AWS 23k 차단분 + 일부 봇 challenge fail)
- Vercel 대시보드 → Observability 요청 수, Function Invocations 감소 확인

### 5.3 1주일 후

- Google Search Console → Crawl Stats → GoogleBot 크롤 성공률 100% 유지 확인
- Vercel On-Demand 비용 다음 사이클(2026-06-13) 청구액 확인
  - 기대: $109 → 약 $75 이하 ($25-30 절감)

---

## 6. 롤백

Custom Rule을 비활성화하거나 삭제하면 즉시 원상 복구. 정전·중요 행사 시 Rule A를 일시 비활성화(국제 컨퍼런스 등에서 한국 외 사용자 일시 증가 시 대비).

---

## 7. 후속 작업

- 1주일 후 비용 절감액 확인하고 메모리 `project_vercel_cost_breakdown.md` 업데이트
- Vercel Observability 항상 켜둘지 또는 끌지 결정 ($20.87/사이클 별도 절감 옵션)
- CF 캐시율(0.95%) 자체를 개선할지 별도 spec 작성 (next.config.mjs의 `Cache-Control` 헤더 + `cf:revalidate` 응답 헤더 검토)

---

## 8. 변경 추적

| 일자 | 변경 |
|------|------|
| 2026-06-06 | 초안 작성 — Rule A/B 설계, CF 대시보드 적용 절차, 검증 계획 |
