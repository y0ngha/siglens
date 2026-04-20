'use server';

import { waitUntil } from '@vercel/functions';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type {
    AnalysisResponse,
    SubmitAnalysisResult,
    Timeframe,
} from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { buildAnalysisCacheKey } from '@/infrastructure/cache/config';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

export async function submitAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    force: boolean = false,
    fmpSymbol?: string
): Promise<SubmitAnalysisResult> {
    // 1. 환경변수 사전 검증
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
        throw new Error(
            'WORKER_URL and WORKER_SECRET environment variables are required'
        );
    }

    // 2. 캐시 확인 (force: true이면 캐시를 건너뛰고 항상 재분석)
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(symbol, timeframe);

    if (!force && cache !== null) {
        try {
            const cached = await cache.get<AnalysisResponse>(cacheKey);
            if (cached !== null) {
                console.log('[Submit] Cache hit:', cacheKey);
                return { status: 'cached', result: cached };
            }
        } catch (error) {
            console.error('[Submit] Cache read failed:', error);
        }
    }

    // 3. Bars + Indicators 서버 재구성 (barsApi 캐시 워밍 시 추가 API 호출 없음)
    const { bars, indicators } = await fetchBarsWithIndicators(
        symbol,
        timeframe,
        fmpSymbol
    );

    // 4. Skills 로딩 + 프롬프트 빌드
    const skillsLoader = new FileSkillsLoader();
    let skills: Awaited<ReturnType<typeof skillsLoader.loadSkills>> = [];
    let skillsDegraded = false;
    try {
        skills = await skillsLoader.loadSkills();
    } catch (error) {
        console.error(
            '[Submit] Skills loading failed, proceeding without skills:',
            error
        );
        skillsDegraded = true;
    }

    const prompt = buildAnalysisPrompt(
        symbol,
        bars,
        indicators,
        skills,
        timeframe
    );

    // 5. jobId 생성 + 메타 저장 (skillsDegraded + reconcile 기준값 포함)
    //
    // lastClose/atr은 pollAnalysisAction에서 AI SL/TP 검증·fallback 기준으로 사용.
    // 마지막 non-null ATR과 마지막 bar 종가를 추출해 저장한다.
    const jobId = crypto.randomUUID();
    const lastClose = bars[bars.length - 1]?.close;
    const atr = lastNonNull(indicators.atr) ?? undefined;
    await setJobMeta(jobId, {
        symbol,
        timeframe,
        skillsDegraded,
        lastClose,
        atr,
    });

    // 6. Worker에 fire-and-forget
    // waitUntil은 Vercel 함수의 maxDuration(300초)까지만 fetch를 유지한다.
    // 이후 Vercel이 커넥션을 끊더라도 Cloud Run은 요청 처리를 계속 진행한다.
    // Cloud Run의 라이프사이클은 res.json() 호출 시점까지이므로,
    // 클라이언트(Vercel) 커넥션 종료와 무관하게 Gemini 호출 → Redis 저장이 완료된다.
    // 폴링 측(pollAnalysisAction)은 Redis에서 결과를 읽으므로 영향 없음.
    waitUntil(
        fetch(`${workerUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': workerSecret,
            },
            body: JSON.stringify({ jobId, prompt }),
        }).catch(error => {
            console.error('[Submit] Worker request failed:', error);
        })
    );

    console.log('[Submit] Job submitted:', jobId, cacheKey);
    return { status: 'submitted', jobId };
}

function lastNonNull(arr: readonly (number | null)[]): number | null {
    for (let i = arr.length - 1; 0 <= i; i--) {
        const v = arr[i];
        if (v !== null) return v;
    }
    return null;
}
