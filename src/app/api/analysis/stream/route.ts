import { handleDispatchedStream } from './_lib/handleDispatchedStream';
import { handleTechnicalStream } from './_lib/handleTechnicalStream';
import { parseStreamBody } from './_lib/parseStreamBody';

/**
 * 불변식: **응답 본문은 User-Agent에 의존하지 않는다.** 봇과 사람은 같은 요청에 같은 본문(원문 +
 * 평이화)을 받는다.
 *
 * 생성 트리거도 UA로 가르지 않는다. 캐시 미스면 봇도 사람과 똑같이 core에 생성을 맡긴다 — 봇에게
 * 즉시 `miss_no_trigger`를 돌려주면 Googlebot이 색인하는 DOM이 "봇 트래픽으로 보여 표시하지 않았어요"
 * 안내문이 된다. 동시성 상한에도 봇 배수를 두지 않는다 — `isBot`은 순수 UA 문자열 매칭이라
 * curl/python-requests/axios 같은 일반 스크립트 클라이언트까지 "봇"으로 잡히는데, 거기에 더 높은 천장을
 * 얹는 건 판별 불가능한 신호에 의존하는 남용 경로다(상한 근거는 `shared/lib/sse/activeStreams.ts`의
 * `canAcceptAnalysisStream` 주석).
 *
 * **UA를 읽는 곳은 하나다: 생성 한도의 크롤러 면제.** UA는 검색 크롤러(Googlebot·Bingbot·Yeti·Daumoa)를
 * *주장할 때* DNS 검증을 **시도할지**만 정한다. 면제는 역방향(PTR) → 크롤러 도메인 접미사 → 순방향 조회가
 * 원래 IP와 맞물릴 때만 주어진다(`shared/api/verifiedCrawler.ts`). 검증하는 IP는 Cloudflare가 덮어쓰는
 * `cf-connecting-ip`뿐이다(위조 가능한 `X-Forwarded-For` 폴백은 면제에 안 쓴다 — `generationQuota.ts`의
 * `isVerifiedCrawlerRequest`). 위조 UA는 DNS에서 떨어져 평소 한도를 받고, 크롤러를 주장하지 않는 UA는 DNS
 * 조회조차 하지 않는다. 면제는 생성 한도에만 적용된다 — 동시성 상한·본문·생성 트리거는 그대로다.
 *
 * 같은 크롤러 판정이 비회원 하루 무료 전체 공개 미터(`meteredRevealGate.ts`)에도 쓰인다. DNS로 검증된
 * 크롤러는 미터를 건너뛰어 항상 현행 free 마스킹을 받는다. 갈리는 기준은 UA가 아니라 검증 결과이고,
 * 미터 대상 방문자가 공개 본문을 받아도 색인되는 SEO 스냅샷(`peekAnalysisStatic`, tier free 고정)은
 * 변하지 않는다.
 */
export const dynamic = 'force-dynamic';

/**
 * `POST /api/analysis/stream` — 인증 없는 공개 SSE 라우트. 인증·tier·한도 판정은 핸들러와 위임받은
 * 액션이 맡는다.
 *
 * 브라우저의 분석 요청은 서버 액션이 아니라 이 라우트를 거쳐야 한다. 서버 액션은 단일 POST라 서버가 LLM을
 * 기다리는 동안 바이트를 보내지 않아 엣지가 유휴 연결을 끊는다(프로덕션 실측: ALB 경유 61.1초, 2026-08
 * 이전 뒤 cloudflared 경유 125.9초, 25초 heartbeat가 있으면 600초 완주). 서버 측 호출자(크론·SSR·봇)는
 * 영향이 없고 `run*`을 직접 불러도 된다.
 *
 * 본문: `{ type: AnalysisType; params: <종류별 모양> }`. `technical`은 전용 핸들러, 나머지는 `DISPATCH`
 * 표로 위임한다.
 */
export async function POST(request: Request): Promise<Response> {
    const parsed = await parseStreamBody(request);
    if (!parsed.ok) return parsed.response;
    const { body } = parsed;
    return body.kind === 'technical'
        ? handleTechnicalStream(request, body.params)
        : handleDispatchedStream(request, body.type, body.params);
}
