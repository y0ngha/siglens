import 'server-only';
import type { ModelId, Tier } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { isE2E } from '@/shared/api/e2eEnv';
import type { Locale } from '@/shared/i18n/locales';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import {
    buildGateError,
    resolveReasoning,
    resolveTierAndByok,
} from '@/shared/lib/byokGate';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/**
 * 게이트가 정한 필드로, core `run*` 호출이 공통으로 받는다. 호출부가 자신의
 * `symbol`/`locale`/`modelId`/`dataProvider`와 함께 core 옵션에 펼쳐 넣는다.
 */
interface GatedAnalysisOptions {
    readonly tier: Tier;
    /** "깊은 생각" 토글 — 무료·비회원이면 이미 `false`로 강제된 값. */
    readonly reasoning: boolean;
    /**
     * 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과 같은 본문을
     * 생성해야 한다(`src/app/api/analysis/stream/route.ts` 상단 불변식과 동일 원칙).
     * 예전에는 봇이면 생성을 막아 Googlebot이 실제 분석 대신 "봇 트래픽" 안내문을 색인했다.
     *
     * `true`는 클라이언트가 `cacheOnly`를 요청했을 때뿐이다(큐레이션 밖 종목의 첫 입력
     * 전 조회 — `useAiAutoRunAllowed`). 그 값은 UA가 아니라 클라이언트 게이트에서 오고,
     * 생략·`false`면 지금과 같은 동작이라 클라이언트가 속여도 새 비용 경로가 없다.
     */
    readonly skipEnqueueIfMiss: boolean;
    /** 게이트가 과금 대상으로 판정했을 때만 있는, 회원이 저장한 BYOK 키. */
    readonly userApiKey?: string;
}

interface RunGatedAnalysisParams<R> {
    /** 최종 catch 로그의 접두어. 예: `'runFinancialsAnalysisAction'`. */
    readonly actionName: string;
    readonly modelId: ModelId;
    /** 게이트 거부·예외 문구의 로케일. */
    readonly locale: Locale;
    /** 클라이언트가 보낸 "깊은 생각" 원본 토글. tier 규칙은 `resolveReasoning`이 적용한다. */
    readonly reasoning: boolean | undefined;
    /**
     * E2E 단락. 호출부는 이 콜백 안에서 `import('@/shared/api/e2eAnalysisStub')`를
     * **동적으로** 불러, 스텁과 JSON 픽스처가 프로덕션 메인 번들이 아닌 지연 청크에
     * 놓이게 하면서도 vitest 러너가 분기를 해석할 수 있게 한다.
     */
    readonly e2eResult: () => Promise<R>;
    /** 게이트가 정한 옵션을 받아 core `run*`을 호출한다. */
    readonly submit: (gated: GatedAnalysisOptions) => Promise<R>;
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(core가 `miss_no_trigger`). 클라이언트의
     * AI 자동 실행 게이트가 첫 입력 전 조회에 쓴다.
     */
    readonly cacheOnly?: boolean;
}

/**
 * 패널별 분석 Server Action(fundamental·financials·congress·investor-flows)이
 * 공유하는 흐름: E2E 픽스처 → 현재 사용자 → tier·BYOK 게이트 → core 호출.
 *
 * E2E 스텁 로드 실패를 포함해 모든 throw를 잡아 로케일 문구가 담긴
 * `AnalysisGateBlockedResult`로 바꾼다(SERVER.md#SA-1: Server Action은 원시 예외를
 * 전파하지 않는다). 이 catch-all이 여기 있어야 각 훅의 `isGateBlockedResult` 검사가
 * 모든 패널에서 믿을 수 있는 판별자로 남는다.
 *
 * 종합 분석은 이 경로를 쓰지 않는다 — 보유 포지션 버킷을 추가로 읽고 여러 entity로
 * 팬아웃하기 때문이다.
 */
export async function runGatedAnalysis<R>({
    actionName,
    modelId,
    locale,
    reasoning,
    e2eResult,
    submit,
    cacheOnly,
}: RunGatedAnalysisParams<R>): Promise<R | AnalysisGateBlockedResult> {
    try {
        if (isE2E()) {
            return await e2eResult();
        }

        const user = await getCurrentUser();
        const gate = await resolveTierAndByok(
            user?.id ?? null,
            modelId,
            locale
        );
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await submit({
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss: cacheOnly === true,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error(`[${actionName}] unexpected error:`, err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
