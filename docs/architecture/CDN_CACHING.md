# CDN(Cloudflare) 캐싱·봇 보호 런북

> 적용 주체: 사용자(CF 대시보드). 설계 근거: [`docs/superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md`](../superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md).
> 관련 메모리: `project_cloudflare_vercel_infra`.

## 0. 현재 상태 (2026-06-15 실측)

siglens.io는 **grey-cloud(DNS only)** — CF 프록시 OFF. 헤더에 `server: Vercel`·`cf-ray` 없음, A 레코드가 Vercel IP 직결(네임서버는 CF). 6/6엔 주황구름 + WAF 봇 차단이 활성이었다. 그 사이 OFF로 바뀌어 WAF·봇 차단이 비활성 → 봇이 Vercel 직격 → ISR Write 비용 증가.

## 1. 사전 점검 (전환 전 필수)

1. grey-cloud가 의도였는지 확인(SSL/리다이렉트 루프 회피 목적이었을 수 있음).
2. CF SSL/TLS 모드를 **Full (Strict)** 로 설정(Vercel은 유효 인증서 제공; `Flexible`은 루프·혼합콘텐츠 유발).
3. A/CNAME 레코드를 **주황구름(프록시 ON)** 으로 토글.
4. `/`·`/AAPL`·`/AAPL/overall`에서 **리다이렉트 루프·SSL 오류 없음 + `cf-ray` 헤더 출현**을 실측 검증.

## 2. WAF 룰 (무료 플랜: custom 5개 한도 중 3개 사용)

| # | 이름 | 표현식 | 액션 |
|---|---|---|---|
| R1 | Block scanner paths | `http.request.uri.path contains ".php" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git"` | Block |
| R2 | Block abusive ASN | `ip.geoip.asnum in {132203 13220}` | Block |
| R3 | Challenge non-KR 비검증 봇 | `(ip.geoip.country ne "KR") and (not cf.client.bot) and (not lower(http.user_agent) contains "yeti") and (not lower(http.user_agent) contains "daum") and (not lower(http.user_agent) contains "claudebot") and (not lower(http.user_agent) contains "claude-searchbot") and (not lower(http.user_agent) contains "perplexitybot") and (not lower(http.user_agent) contains "oai-searchbot")` | Managed Challenge |

- **R3가 핵심 레버**: 검증 검색봇(`cf.client.bot`=Googlebot/Bingbot)·한국 검색봇(Yeti/Daum)·살린 AI봇(Claude/Perplexity/OAI)은 통과, 나머지 non-KR 비검증 봇은 Managed Challenge → JS 못 풀어 렌더 불가 → first-gen ISR write 0. robots.txt를 무시하는 봇을 잡는 catch-all.
- **6/6 대비 차이**: R2에서 ClaudeBot AWS 범위(216.73.216.0/24) 제외(하드 Block 해제됨, robots crawlDelay로 완화). R3에 Claude/Perplexity/OAI UA 예외(접근 유지).
- ⚠️ **적용 시 CF Security Analytics(24h)로 top-offender IP/ASN 재확인** 후 R2의 ASN 현행화(132203·13220은 6/6 식별값).

## 3. HTML Cache Rule — 보류

App Router는 같은 URL에서 완전 HTML과 RSC 페이로드를 요청 헤더(`RSC` 등)로 분기 응답하며 `Vary: rsc, next-router-*`를 보낸다. CF는 기본적으로 `Accept-Encoding` 외 Vary를 캐싱에 반영하지 않아, 순진한 "Cache Everything"은 한 변형을 모두에게 제공해 **페이지가 깨질 수 있다**. 안전하게 하려면 `RSC` 헤더 부재 시(완전 HTML)만 캐싱하도록 cache-key/eligibility 커스터마이즈가 필요한데 무료 플랜에선 제한적이다. 비용 직격은 R3(WAF)가 수행하므로 **WAF 효과 측정 후 별도 후속**으로 정밀 설계한다.

## 4. 검증

- 전환 직후: `cf-ray` 출현 + 루프/SSL 무오류.
- 며칠 뒤: **Vercel ISR Write 일별 추세 하락** + CF Security Analytics에서 R3 Challenge 이벤트 증가.
