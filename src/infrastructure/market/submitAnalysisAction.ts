'use server';

import { waitUntil } from '@vercel/functions';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type {
    AnalyzeVariables,
    SubmitAnalysisResult,
    Timeframe,
} from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { buildAnalysisCacheKey } from '@/infrastructure/cache/config';
import type { RunAnalysisResult } from '@/infrastructure/market/analysisApi';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

export async function submitAnalysisAction(
    variables: AnalyzeVariables,
    timeframe: Timeframe
): Promise<SubmitAnalysisResult> {
    const { symbol, bars, indicators } = variables;

    // 1. 환경변수 사전 검증
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
        throw new Error(
            'WORKER_URL and WORKER_SECRET environment variables are required'
        );
    }

    // 2. 입력값 검증
    if (!symbol || !bars || bars.length === 0 || !indicators) {
        throw new Error('symbol, bars, and indicators are required');
    }

    // 3. 캐시 확인
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(symbol, timeframe);

    if (cache !== null) {
        try {
            const cached = await cache.get<RunAnalysisResult>(cacheKey);
            if (cached !== null) {
                console.log('[Submit] Cache hit:', cacheKey);
                return { status: 'cached', result: cached };
            }
        } catch (error) {
            console.error('[Submit] Cache read failed:', error);
        }
    }

    // 4. Skills 로딩 + 프롬프트 빌드
    const skillsLoader = new FileSkillsLoader();
    const skills = await skillsLoader.loadSkills();
    const skillsDegraded = false;

    const prompt = buildAnalysisPrompt(
        symbol,
        bars,
        indicators,
        skills,
        timeframe
    );

    // 5. jobId 생성 + 메타 저장 (skillsDegraded 포함)
    const jobId = crypto.randomUUID();
    await setJobMeta(jobId, { symbol, timeframe, skillsDegraded });

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
