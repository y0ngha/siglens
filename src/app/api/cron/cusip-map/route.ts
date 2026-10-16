import { handleLeasedCron } from '../leasedCron';
import { createCikSymbolMapDeps, createCusipMapDeps } from './createDeps';
import { runCikSymbolMapSync } from '@/entities/investor-flows/server/syncCikSymbolMap';
import { runCusipMapSync } from '@/entities/investor-flows/server/syncCusipMap';

/**
 * 마감 10분: 심볼 1,500개 ÷ 동시 3 × FMP ~0.8초 ≈ 7분 + OpenFIGI 검증(키 없으면 분당 25요청 × 10잡)
 * 여유. 락 TTL 15분 = 마감 + 마지막 청크(FMP 재시도 백오프 최악 ~60초) + 주간 CIK 맵 갱신(`company_tickers.json` 요청 최악
 * 75초 + 맵 교체 트랜잭션) 여유(SERVER.md#CC-7, `route.test.ts`가 실제 상수로 검증).
 */
const CUSIP_MAP_DEADLINE_MS = 10 * 60 * 1000;
const CUSIP_MAP_LEASE_TTL_SECONDS = 15 * 60;

/**
 * CUSIP↔심볼 맵 증분 채우기 cron(`PATCH /api/cron/cusip-map`) — 매핑 없는 미국 종목을 FMP profile →
 * (ISIN 파생 CUSIP + OpenFIGI 검증)으로 채운다. 실행당 상한이 있어 맵이 찰 때까지 매일 돌아도 되고,
 * 다 찬 뒤에는 후보가 없어 즉시 끝난다. 후보 0건으로 끝나는 첫 실행이 "전수 한 바퀴 완료" 표식을 세우고(set-once), 그
 * 표식이 서야 sec-13f가 수집을 시작한다. 이어서 주 1회 `company_tickers.json`으로 `sec_cik_symbol_map`(Form 144·증자 공시의
 * 유니버스 CIK 사전 필터)을 갱신한다 — 주 1건이라 SEC 공유 락 밖이다(`shared/config/investorFlows.ts`의 불변식).
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'cusip-map',
        leaseTtlSeconds: CUSIP_MAP_LEASE_TTL_SECONDS,
        deadlineMs: CUSIP_MAP_DEADLINE_MS,
        run: async ({ isDeadlineReached }) => ({
            ...(await runCusipMapSync(createCusipMapDeps(isDeadlineReached))),
            // CUSIP 매핑 뒤 주 1회 SEC CIK → 심볼 맵 갱신(이번 실행이 전수 한 바퀴 표식을 세웠다면 바로 만든다). 던지지 않는다.
            cikMap: await runCikSymbolMapSync(createCikSymbolMapDeps()),
        }),
    });
}
