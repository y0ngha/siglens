import 'server-only';
import type { ModelId, Tier } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/**
 * The gate-derived fields every core `run*` call takes. The caller spreads them
 * into its core options next to its own `symbol`/`locale`/`modelId`/`dataProvider`.
 */
interface GatedAnalysisOptions {
    readonly tier: Tier;
    /** "깊은 생각" toggle — already forced `false` for free/anonymous callers. */
    readonly reasoning: boolean;
    /**
     * 2026-09-27: 더 이상 UA로 가르지 않는다 — 봇의 캐시 미스도 사람과 같은 본문을
     * 생성해야 한다(`src/app/api/analysis/stream/route.ts` 상단 불변식과 동일 원칙).
     * 예전에는 봇이면 생성을 막아 Googlebot이 실제 분석 대신 "봇 트래픽" 안내문을 색인했다.
     *
     * `true`는 클라이언트가 `cacheOnly`를 요청했을 때뿐이다(큐레이션 밖 종목의 첫 입력
     * 전 조회 — `useAiAutoRunAllowed`). 그 값은 UA가 아니라 클라이언트 게이트에서 오고,
     * 생략·`false`면 지금과 같은 동작이라 클라이언트가 속여도 새 비용 경로가 없다.
     */
    readonly skipEnqueueIfMiss: boolean;
    /** Member's stored BYOK key, present only when the gate charged it. */
    readonly userApiKey?: string;
}

interface RunGatedAnalysisParams<R> {
    /** Log prefix for the catch-all, e.g. `'runFinancialsAnalysisAction'`. */
    readonly actionName: string;
    readonly modelId: ModelId;
    /** 게이트 거부·예외 문구의 로케일. */
    readonly locale: Locale;
    /** Raw client "깊은 생각" toggle; `resolveReasoning` applies the tier rule. */
    readonly reasoning: boolean | undefined;
    /**
     * E2E short-circuit. Callers load the stub with a DYNAMIC
     * `import('@/shared/api/e2eAnalysisStub')` inside this callback so the stub +
     * JSON fixture sit in a lazy chunk (not the prod main bundle) while the
     * branch stays resolvable by the vitest runner.
     */
    readonly e2eResult: () => Promise<R>;
    /** The core `run*` call, given the gate-derived options. */
    readonly submit: (gated: GatedAnalysisOptions) => Promise<R>;
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(core가 `miss_no_trigger`). 클라이언트의
     * AI 자동 실행 게이트가 첫 입력 전 조회에 쓴다.
     */
    readonly cacheOnly?: boolean;
}

/**
 * Shared flow of the per-panel analysis Server Actions (fundamental, financials,
 * congress): E2E fixture → current user → tier + BYOK gate → core submit.
 *
 * Every throw — including an E2E stub load failure — is caught and mapped to a
 * localized `AnalysisGateBlockedResult` (SERVER.md#SA-1: Server Actions never
 * propagate raw exceptions). Keeping that catch-all here is what keeps the
 * hooks' `isGateBlockedResult` check a reliable discriminant across all three.
 *
 * The overall action is not routed through this: it additionally reads the
 * holding position bucket and fans out to several entities.
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
