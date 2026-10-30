import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { resolveTierOnly } from '@/shared/lib/byokGate';
import { sseResponse } from './streamResponses';

/** `e2eTechnicalResponse`가 fixture를 고르고 개인화 여부를 근사하는 데 쓰는 요청 정보. */
export interface E2eTechnicalInput {
    userId: string | null;
    symbol: string;
    reanalyze: boolean | undefined;
    genericErrorMessage: string;
}

/**
 * E2E 모드에서 `technical` 요청에 고정 fixture를 SSE로 돌려준다(`isE2E()`일 때만 호출).
 *
 * 스텁 모듈은 동적 import한다 — `E2E_TEST`가 꺼진 프로덕션 번들에서 죽은 코드로 빠진다. 재분석 의도는
 * 운영에서 캐시를 건너뛴 새 생성(`done`)으로 끝나므로 스텁도 같은 status를 줘야 클라이언트가 운영과 같은
 * 진행 화면 흐름을 탄다(`e2eGeneratedTechnical` JSDoc).
 *
 * 스텁은 버킷이 계산되기 **전에** fixture를 돌려주므로 `personalized`를 평소처럼 파생할 수 없다.
 * 배지 배선을 E2E에서 검증할 수 있게 `resolveHoldingPositionBucket`과 같은 조건(free가 아니고 홀딩이
 * 존재)으로 근사한다. fixture가 실제 버킷·시세를 반영하지 않으니 그 해석은 E2E에서 무의미하다.
 */
export async function e2eTechnicalResponse({
    userId,
    symbol,
    reanalyze,
    genericErrorMessage,
}: E2eTechnicalInput): Promise<Response> {
    const [tier, { e2eCachedTechnical, e2eGeneratedTechnical }] =
        await Promise.all([
            resolveTierOnly(userId),
            import('@/shared/api/e2eAnalysisStub'),
        ]);
    const stub =
        reanalyze === true
            ? e2eGeneratedTechnical(tier)
            : e2eCachedTechnical(tier);
    const personalized =
        tier !== 'free' && userId !== null
            ? await hasHolding(userId, symbol)
            : false;
    return sseResponse(
        Promise.resolve({ ...stub, personalized }),
        genericErrorMessage
    );
}

/** 보유종목 조회. 실패하면 `false`로 낮춘다 — 배지만 빠질 뿐 응답은 막지 않는다. */
async function hasHolding(userId: string, symbol: string): Promise<boolean> {
    try {
        const { db } = getDatabaseClient();
        const holding = await new DrizzlePortfolioRepository(
            db
        ).findByUserAndSymbol(userId, symbol.toUpperCase());
        return holding !== null;
    } catch (error) {
        logActionError(
            '[streamAnalysisRoute] E2E personalized-flag holding read failed, degrading to false:',
            error
        );
        return false;
    }
}
