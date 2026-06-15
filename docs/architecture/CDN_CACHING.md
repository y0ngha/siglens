# CDN(Cloudflare) 캐싱·봇 보호 런북

> 적용 주체: 사용자(CF 대시보드). 설계 근거: [`docs/superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md`](../superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md).
> 관련 메모리: `project_cloudflare_vercel_infra`.

## 0. 현재 상태 (2026-06-15 실측 — 응답 헤더 + CF 대시보드)

- **apex `siglens.io` + `www.siglens.io`만 grey-cloud(DNS 전용)** — CF 프록시 OFF (응답 헤더에 `server: Vercel`, `cf-ray` 없음). 둘 다 CNAME → `*.vercel-dns-017.com`.
- `auto-trade.siglens.io`(CNAME → `vercel-dns-016`)는 **이미 orange(프록시됨)** — orange-over-Vercel CNAME이 이 계정에서 정상 동작한다는 증거.
- **SSL/TLS 모드 = Full (Strict)** (대시보드 "현재 실행 중: 전체(엄격)") — orange 전환에 안전, 변경 불필요.
- 6/6엔 apex도 orange + WAF 봇 차단이 활성이었는데 그 사이 apex/www가 grey로 바뀜 → WAF·봇 차단 비활성 → 봇이 Vercel 직격 → ISR Write 비용 증가.
- 존: account `2462030a7138ffe4be726f78046fd6d7` · zone `siglens.io` (free plan). DNS: `dash.cloudflare.com/<account>/siglens.io/dns/records`.

## 1. 사전 점검 / 전환 (2026-06-15 현황 반영)

1. ✅ **SSL/TLS = Full (Strict) 확인됨** — 변경 불필요(`Flexible`이면 루프·혼합콘텐츠 유발).
2. **`siglens.io`(apex) → `www.siglens.io` 순서로 프록시 토글**: DNS 레코드 행 "편집" → 프록시 상태 클릭(☁️ "DNS 전용" → 🟠 "프록시됨") → 저장. `auto-trade`는 이미 orange라 대상 아님.
   - **apex 먼저 토글 후 검증**, 이상 없으면 www. 문제 시 즉시 회색으로 되돌리면 원복(즉시 reversible).
3. 전환 직후 `/`·`/AAPL`·`/AAPL/overall`에서 **`cf-ray` 출현 + 리다이렉트 루프·SSL 오류 없음**을 실측 검증.

## 2. WAF 룰 (무료 플랜: custom 5개 한도 중 3개 사용)

| # | 이름 | 표현식 | 액션 |
|---|---|---|---|
| R1 | Block scanner paths | `http.request.uri.path contains ".php" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git"` | Block |
| R2 | Block abusive ASN | `ip.geoip.asnum in {132203 13220}` | Block |
| R3 | Challenge non-KR 비검증 봇 (핵심 레버, **배포본**) | `(ip.geoip.country ne "KR") and (not cf.client.bot) and (not starts_with(http.request.uri, "/api"))` | Managed Challenge |

- **R3가 핵심 레버**: 검증 검색봇(`cf.client.bot`=Googlebot/Bingbot)·한국 검색봇(geo KR=Yeti/Daum)·**CF-verified AI봇**은 통과, 나머지 non-KR 비검증 봇은 Managed Challenge → JS 못 풀어 렌더 불가 → first-gen ISR write 0. `/api` 제외는 **비KR 사용자의 앱 API 호출이 챌린지되는 걸 막는 올바른 조건**.
- **R3 무수정 결정(2026-06-15)**: `cf.client.bot`이 ClaudeBot·Claude-SearchBot·OAI-SearchBot·GPTBot을 **verified로 이미 통과**시킴 → UA 예외 불필요. **PerplexityBot은 CF가 de-list**(stealth crawling)라 챌린지되지만, CF가 악성으로 분류한 것이라 그대로 둠. (이 스펙 초안의 UA 예외 행은 "이들이 비검증"이라는 전제 오류 — 실제로는 Perplexity 빼고 다 verified라 **미적용**.)
- ⚠️ **R2 ASN(132203·13220)은 6/6 식별값** — Security Analytics(24h)로 현행화. ClaudeBot AWS /24는 6/6에 하드 Block 후 사용자가 해제(robots crawlDelay 60s로 완화).

## 3. HTML Cache Rule — 적용·검증됨 (2026-06-15)

App Router는 같은 URL에서 완전 HTML과 RSC 페이로드를 요청 헤더(`RSC`)로 분기하며 `Vary: rsc, next-router-*`를 보낸다. naive "Cache Everything"은 RSC 페이로드를 브라우저에 서빙해 **페이지를 깨뜨릴 수 있다**. 무료 플랜 Cache Rule에 **"요청 헤더(Request Header)" 필드가 있어 RSC-aware 캐싱이 가능**하다(에지 TTL 무료 최소값=2시간).

**배포된 룰 "Cache HTML documents (non-RSC)"**:
- 매칭(빌더): `(http.request.method eq "GET" and not len(http.request.headers["rsc"]) > 0 and not starts_with(http.request.uri.path, "/api"))` — GET + RSC 헤더 부재(RSC nav·prefetch 제외) + /api 제외. (/_next·인증경로는 미제외 — 정적자산 캐싱 무해, 인증은 클라 렌더 셸이라 무해.)
- 캐시 적합성=Eligible · 에지 TTL=override **2h** · 브라우저 TTL=**Respect origin**(max-age=0 → 매 방문 revalidate) · SWR ON · 강한 ETag ON · 원본 오류 패스스루 ON.

**검증(curl)**: `/AAPL` → `cf-cache-status: HIT`(엣지 캐싱) + `cache-control: max-age=0`(브라우저 항상 최신) + 본문 HTML. **`RSC:1` 요청 → `cf-cache-status: DYNAMIC`(우회) + `text/x-component` RSC 페이로드** = footgun 회피(클라 navigation 정상).

⚠️ 무료 플랜은 cache key에 헤더를 못 넣어 RSC 분기는 **매칭 조건에 의존** — 배포 후 RSC 우회를 반드시 실측. 문제 시 룰 비활성화 + "Purge Everything"으로 즉시 원복.

> **Vercel "Invalid Configuration"**: orange 프록시 시 Vercel이 CF IP를 봐서 뜨는 정상/cosmetic 표시(사이트 작동). 인증서 갱신(HTTP-01)은 프록시 통과로 보통 OK — 모니터 대상.

## 4. 검증

- 전환 직후: `cf-ray` 출현 + 루프/SSL 무오류.
- 며칠 뒤: **Vercel ISR Write 일별 추세 하락** + CF Security Analytics에서 R3 Challenge 이벤트 증가.
