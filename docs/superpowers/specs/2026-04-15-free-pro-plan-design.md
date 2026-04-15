# Siglens Free/Pro 플랜 구분 설계안 (2026-04-15)

## 1. 개요 (Overview)

Siglens 프로젝트의 지속 가능성을 위한 BM(Business Model) 설계안입니다. 사용자 로그인 기능을 기반으로 무료(Free) 사용자와 유료(Pro) 사용자에게 차별화된 AI 분석 가치를 제공합니다.

---

## 2. 권한 및 인증 (Auth Strategy)

### 2.1. 인증 방식: 로그인 기반 (Full Auth)
- **추천 도구**: NextAuth.js (또는 Clerk, Supabase Auth)
- **이유**:
    - 장기적인 사용자 관리(히스토리 저장, 북마크 등)에 유리함.
    - Pro 권한(Subscription Status)을 서버 사이드에서 안전하게 검증 가능.

### 2.2. 사용자 데이터 모델 (Database Schema)
- **User Table**: `id`, `email`, `name`, `plan` ('free' | 'pro'), `subscriptionId`
- **Usage Table**: `userId`, `date`, `count` (일일 분석 횟수 제한용)

---

## 3. 플랜별 차별화 (Tier Differentiation)

| 항목 | 무료 (Free) | 유료 (Pro) |
| :--- | :--- | :--- |
| **분석 모델** | Gemini Flash / Claude Haiku | **Gemini 2.5 Pro / Claude Opus** |
| **데이터 범위** | 일봉(Daily) 데이터 전용 | **분봉(1m~60m) 데이터 포함** |
| **분석 횟수** | 일 5회 (Rate Limited) | **무제한 또는 매우 넉넉함** |
| **Skills 분석** | 기본 지표 및 캔들 패턴 | **고급 차트 패턴 및 전략 (전체 Skills)** |
| **광고/제휴** | 분석 리포트 하단 제휴 링크 노출 | **광고 제거 (Ad-free)** |
| **부가 기능** | - | 분석 리포트 PDF 저장, 실시간 알람(예정) |

---

## 4. 광고 및 수익화 전략 (Ad & Monetization Strategy)

무료 사용자(Free Tier)를 대상으로 한 수익화는 사용자 경험(UX)을 해치지 않는 선에서 전략적으로 배치합니다.

### 4.1. 추천 배치 전략 (Hybrid Strategy)
- **전략 1: 분석 대기 화면 (Engagement)**
    - AI 분석 리포트가 생성되는 3~10초 동안 스켈레톤(Skeleton) 화면 중앙에 광고 노출.
    - 주목도가 가장 높으며 사용자가 결과를 기다리는 시간을 활용함.
- **전략 2: AI 리포트 하단 (Contextual)**
    - 분석 결과가 끝나는 지점에 증권사 계좌 개설이나 추천 도구 링크 배치.
    - 분석 내용을 다 읽은 사용자의 다음 행동(Call to Action)을 유도함.

### 4.2. 구현 팁 (Implementation Tip)
- **컴포넌트화**: `AdBanner` 컴포넌트를 생성하여 `isFreeUser` 프롭(Prop)에 따라 노출 여부를 결정.
- **정책 준수**: "클릭해야 기능을 제공한다"는 식의 강제성은 지양하며, 자연스러운 노출을 통해 구글 애드센스 정책을 준수함.

---

## 5. 데이터 흐름 (Data Flow)

1.  **사용자 요청**: 클라이언트가 `/api/analyze` 호출.
2.  **세션 확인**: 서버에서 `getServerSession()`을 통해 사용자 인증 여부 및 `plan` 확인.
3.  **데이터 수집**:
    - `free`: `fetchBarsWithIndicators` (Daily bars).
    - `pro`: `fetchIntradayBars` (1m, 5m, 15m 등 타임프레임 확장).
4.  **AI 분석 수행**:
    - `free`: Gemini Flash 모델 호출.
    - `pro`: Gemini 2.5 Pro 모델 호출 + 더 풍부한 데이터 컨텍스트 제공.
5.  **결과 반환**: 분석 리포트와 함께 Pro 권한에 따른 UI 요소(제휴 링크 유무 등) 처리.

---

## 6. 구현 로드맵 (Implementation Roadmap)

1.  **Phase 1: 인증 인프라 구축**
    - NextAuth.js 및 데이터베이스(PostgreSQL/Supabase) 연동.
    - 로그인/로그아웃 UI 구현.
2.  **Phase 2: 분석 로직 분기**
    - API 핸들러에서 사용자의 `plan`에 따라 모델과 데이터를 동적으로 선택하는 로직 구현.
    - Upstash Redis를 활용한 일일 횟수 제한(Rate Limiting) 적용.
3.  **Phase 3: 결제 연동**
    - Stripe 또는 LemonSqueezy를 통한 정기 구독 연동.
    - Webhook을 통해 결제 완료 시 사용자의 `plan`을 'pro'로 자동 업데이트.
4.  **Phase 4: Pro 전용 기능 강화**
    - 분봉 데이터 연동 및 Pro 전용 Skills 추가.
    - 리포트 저장 및 PDF 내보내기 기능 구현.

---

## 7. 결론 (Conclusion)

이 설계는 "소소한 수익화"를 넘어 Siglens를 전문적인 분석 플랫폼으로 성장시키기 위한 초석입니다. 특히 **Gemini 2.5 Pro**를 통한 분석 성능의 차별화가 사용자들에게 결제할 강력한 명분을 제공할 것입니다.
