import 'server-only';
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import { getYahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';
import { FmpFundamentalClient } from './fundamentalClient';
import {
    classifyYahooGrades,
    resolveGradesConsensus,
    type GradesConsensusWithSource,
} from './gradesConsensusSource';

/**
 * FMP 클라이언트에서 투자의견 분포만 Yahoo의 현재 분포로 바꿔 끼운다(미국 종목, 실 FMP 경로 전용).
 * 결정 규칙은 `resolveGradesConsensus` 한 곳에 있다. 가벼운 요약(변경 이력 모듈 없음)이라 비용이 작고,
 * 같은 요약을 애널리스트 뷰가 공유한다.
 */
export class CurrentGradesFmpClient extends FmpFundamentalClient {
    override async getGradesConsensus(
        symbol: string
    ): Promise<FundamentalGradesConsensusInput | null> {
        const summary = await getYahooAnalystSummary(symbol, {
            includeActions: false,
        });
        const result: GradesConsensusWithSource | null =
            await resolveGradesConsensus(classifyYahooGrades(summary), () =>
                super.getGradesConsensus(symbol)
            );
        return result;
    }
}
