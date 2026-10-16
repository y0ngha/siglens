import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { DrizzleInvestorFlowsDartRepository } from '../api/investorFlowsDartRepository';
import { krSymbolToStockCode } from '../lib/dartSymbol';
import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../lib/investorFlowsTag';
import type { DartCorpRecord } from '../model';
import { resolveFakeDartCorp } from './fakeKrDart';

async function loadFromDatabase(
    symbol: string
): Promise<DartCorpRecord | null> {
    const stockCode = krSymbolToStockCode(symbol);
    if (stockCode === null) return null;
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[investor-flows] database unavailable');
    return new DrizzleInvestorFlowsDartRepository(client.db).resolveCorpCode(
        stockCode
    );
}

/**
 * 한국 종목 → DART 회사(고유번호·회사명·우선주면 보통주로 찾았는지). 화면이 "지분공시는 회사 단위라 보통주와 같은 내용"
 * 안내를 낼지 정하고, 에이전트 도구가 같은 사실을 모델에 알린다. 매핑은 스냅샷 provider도 하지만 core 스냅샷 타입에 실을 자리가
 * 없어 따로 읽는다(작은 색인 조회). 스냅샷과 같은 12시간·같은 태그라 공시 수집의 종목 무효화와 백필 완료 무효화를 함께 탄다.
 *
 * 부가 정보라 실패는 `null`(안내 생략)로 낮춘다 — 캐시 **밖**에서 바꿔 장애가 TTL 동안 굳지 않는다. Next 제어 흐름 오류는 다시
 * 던진다. E2E는 가짜 DART 데이터에서 같은 매핑 규칙으로 찾는다.
 */
export async function getKrDartCorp(
    symbol: string
): Promise<DartCorpRecord | null> {
    const upper = symbol.toUpperCase();
    if (isE2E()) return resolveFakeDartCorp(upper, new Date());
    try {
        return await staticSymbolCache<DartCorpRecord | null>(
            ['investor-flows:kr-dart-corp-v1', upper],
            upper,
            () => loadFromDatabase(upper),
            [investorFlowsTag(upper), INVESTOR_FLOWS_READINESS_TAG],
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[getKrDartCorp] DART corp lookup failed, skipping the note:',
            error
        );
        return null;
    }
}
