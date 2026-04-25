import { Redis } from '@upstash/redis';
import express, { type Request, type Response } from 'express';
import { constants } from 'node:http2';
import { callClaude } from './claude.js';
import { config } from './config.js';
import { callGemini, MAX_TOKENS_CODE } from './gemini.js';
import { withRetry } from './retry.js';

interface GeminiWithFallbackOptions {
    maxAttempts?: number;
    signal?: AbortSignal;
    abortIfCumulativeDelayReachesMs?: number;
}

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

// Must match JOB_TTL_SECONDS in src/infrastructure/jobs/queue.ts (cannot import across module boundary).
const JOB_TTL_SECONDS = 3600;
const AI_RETRY_MAX_ATTEMPTS = 5;
const AI_RETRY_MAX_ATTEMPTS_FREE = 3;
const AI_RETRY_DELAY_MS = 5000;
const ANALYSIS_FREE_KEY_MAX_RETRY_DELAY_MS = 30_000;
const BRIEFING_MAX_RETRY_DELAY_MS = 10_000;

// 진행 중인 job의 AbortController를 보관 — /cancel 엔드포인트 수신 시 즉시 abort 가능
const activeJobs = new Map<string, AbortController>();

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

/** MAX_TOKENS 발생 시 시도할 thinkingBudget 단계 시퀀스를 반환한다 (엄격한 감소 순서). */
function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [initial, Math.floor(initial / 2), 8192, 4096, 2048, 0];
    return candidates.reduce<number[]>((acc, budget) => {
        if (acc.length === 0 || budget < acc[acc.length - 1]) {
            return [...acc, budget];
        }
        return acc;
    }, []);
}

/** MAX_TOKENS 발생 시 thinkingBudget을 단계적으로 낮춰가며 시도; 일시적 에러는 outer withRetry로 전파한다. */
async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string,
    signal?: AbortSignal
): Promise<string> {
    const budgets = getThinkingBudgetSequence(config.gemini.thinkingBudget);

    for (const budget of budgets) {
        try {
            return await callGemini(prompt, {
                apiKey,
                model: config.gemini.model,
                thinking: budget > 0,
                thinkingBudget: budget,
                signal,
            });
        } catch (error) {
            if (isMaxTokensError(error)) {
                const idx = budgets.indexOf(budget);
                const next = budgets[idx + 1];
                if (next !== undefined) {
                    console.warn(
                        `[Worker] MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                // thinking off(budget=0)에서도 MAX_TOKENS → 응답 자체가 너무 긴 경우
                console.error(
                    '[Worker] MAX_TOKENS even with thinking disabled. Response is too long.'
                );
                throw error;
            }

            // 429/5xx 등 일시적 에러 → 외부 withRetry로 전파
            throw error;
        }
    }

    // unreachable: 루프는 반드시 return 또는 throw로 종료됨
    throw new Error('All thinking budget steps exhausted');
}

async function callGeminiWithFallback(
    prompt: string,
    apiKey: string,
    options: GeminiWithFallbackOptions = {}
): Promise<string> {
    const {
        maxAttempts = AI_RETRY_MAX_ATTEMPTS,
        signal,
        abortIfCumulativeDelayReachesMs,
    } = options;
    return withRetry(() => callGeminiReducingBudget(prompt, apiKey, signal), {
        maxAttempts,
        baseDelayMs: AI_RETRY_DELAY_MS,
        abortIfCumulativeDelayReachesMs,
    });
    // TODO: fallback model 임시 비활성화
    // free API key의 할당량이 key 단위로 공유되어 fallback도 즉시 실패하는 문제 확인 필요
    // try {
    //     return await withRetry(() => callGeminiReducingBudget(prompt, apiKey), ...);
    // } catch {
    //     return withRetry(() => callGeminiReducingBudget(prompt, apiKey, fallbackModel), ...);
    // }
}

async function callGeminiWithKeyFallback(
    prompt: string,
    signal: AbortSignal | undefined,
    freeKeyDelayLimit: number
): Promise<string> {
    const { freeApiKey, apiKey } = config.gemini;

    if (freeApiKey) {
        try {
            return await callGeminiWithFallback(prompt, freeApiKey, {
                maxAttempts: AI_RETRY_MAX_ATTEMPTS_FREE,
                signal,
                abortIfCumulativeDelayReachesMs: freeKeyDelayLimit,
            });
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') throw err;
            console.warn(
                '[Worker] Free API key exhausted. Switching to paid key.'
            );
        }
    }

    return callGeminiWithFallback(prompt, apiKey, { signal });
}

async function callAnalysisAI(
    prompt: string,
    signal?: AbortSignal
): Promise<string> {
    if (config.aiProvider === 'claude') return callClaude(prompt, signal);
    return callGeminiWithKeyFallback(
        prompt,
        signal,
        ANALYSIS_FREE_KEY_MAX_RETRY_DELAY_MS
    );
}

async function callBriefingAI(
    prompt: string,
    signal?: AbortSignal
): Promise<string> {
    if (config.aiProvider === 'claude') return callClaude(prompt, signal);
    return callGeminiWithKeyFallback(
        prompt,
        signal,
        BRIEFING_MAX_RETRY_DELAY_MS
    );
}

const app = express();
app.use(express.json({ limit: '2mb' }));

const redis = new Redis({
    url: config.redis.url,
    token: config.redis.token,
});

interface AnalyzeRequest {
    jobId: string;
    prompt: string;
}

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

app.post('/cancel', (req: Request, res: Response) => {
    if (req.headers['x-worker-secret'] !== config.workerSecret) {
        res.status(HTTP_STATUS_UNAUTHORIZED).json({ error: 'Unauthorized' });
        return;
    }

    // express req.body는 any 타입; 실제 필드는 아래 if문에서 검증
    const { jobId } = req.body as { jobId?: string };
    if (!jobId) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
            error: 'jobId is required',
        });
        return;
    }

    const controller = activeJobs.get(jobId);
    if (controller && !controller.signal.aborted) {
        controller.abort();
        console.log(`[Worker] Job ${jobId} aborted via /cancel`);
    } else {
        console.log(
            `[Worker] Job ${jobId} not found or already aborted (completed or different instance)`
        );
    }

    res.json({ status: 'ok', jobId });
});

app.post('/analyze', (req: Request, res: Response) => {
    if (req.headers['x-worker-secret'] !== config.workerSecret) {
        res.status(HTTP_STATUS_UNAUTHORIZED).json({ error: 'Unauthorized' });
        return;
    }

    // express req.body는 any 타입; 실제 필드는 아래 if문에서 검증
    const { jobId, prompt } = req.body as AnalyzeRequest;

    if (!jobId || !prompt) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
            error: 'jobId and prompt are required',
        });
        return;
    }

    console.log(
        `[Worker] Job received: ${jobId} (prompt: ${(prompt.length / 1024).toFixed(1)}KB)`
    );

    const controller = new AbortController();
    activeJobs.set(jobId, controller);

    // Cloud Run은 요청 처리 중에만 CPU를 할당하므로,
    // 응답을 보내지 않고 AI 완료까지 요청을 열어둔다.
    void processJob(jobId, prompt, controller)
        .then(() => {
            res.json({ status: 'done', jobId });
        })
        .catch(error => {
            console.error(`[Worker] Job ${jobId} handler error:`, error);
            res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
                status: 'error',
                jobId,
            });
        })
        .finally(() => {
            activeJobs.delete(jobId);
        });
});

// Key helpers mirror src/infrastructure/jobs/queue.ts (cannot import across module boundary).
// When adding or renaming keys in queue.ts, update cleanupCancelledJob() here in sync.
async function isCancelled(jobId: string): Promise<boolean> {
    const val = await redis.get<string>(`job:${jobId}:cancelled`);
    return val === '1';
}

async function cleanupCancelledJob(jobId: string): Promise<void> {
    await redis.del(
        `job:${jobId}:status`,
        `job:${jobId}:result`,
        `job:${jobId}:error`,
        `job:${jobId}:meta`,
        `job:${jobId}:cancelled`
    );
}

async function processJob(
    jobId: string,
    prompt: string,
    controller: AbortController
): Promise<void> {
    // AI 호출 전 취소 여부 확인 (제출과 처리 사이에 취소됐을 수 있음)
    if (controller.signal.aborted || (await isCancelled(jobId))) {
        console.log(`[Worker] Job ${jobId} cancelled before processing`);
        await cleanupCancelledJob(jobId);
        return;
    }

    await redis.set(`job:${jobId}:status`, 'processing', {
        ex: JOB_TTL_SECONDS,
    });

    try {
        const result = await callAnalysisAI(prompt, controller.signal);

        if (!result || result.trim() === '') {
            throw new Error('AI returned an empty response');
        }

        // AI 완료 후 취소 여부 재확인 — 처리 중 타임프레임이 변경됐을 수 있음
        if (controller.signal.aborted || (await isCancelled(jobId))) {
            console.log(`[Worker] Job ${jobId} cancelled after AI completion`);
            await cleanupCancelledJob(jobId);
            return;
        }

        // result를 먼저 저장한 후 status를 업데이트한다.
        // 순서가 바뀌면 poller가 done을 보고 result를 읽기 전에 빈 값을 만날 수 있다.
        await redis.set(`job:${jobId}:result`, result, {
            ex: JOB_TTL_SECONDS,
        });
        await redis.set(`job:${jobId}:status`, 'done', {
            ex: JOB_TTL_SECONDS,
        });

        console.log(`[Worker] Job ${jobId} completed`);
    } catch (error) {
        // AbortError는 취소 요청에 의한 것 — error로 기록하지 않고 cleanup한다.
        if (controller.signal.aborted) {
            console.log(`[Worker] Job ${jobId} aborted during AI call`);
            await cleanupCancelledJob(jobId);
            return;
        }

        const message =
            error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Job ${jobId} failed:`, message);

        await redis.set(`job:${jobId}:error`, message, {
            ex: JOB_TTL_SECONDS,
        });
        await redis.set(`job:${jobId}:status`, 'error', {
            ex: JOB_TTL_SECONDS,
        });
    }
}

interface BriefingRequest {
    jobId: string;
    prompt: string;
}

app.post('/briefing', (req: Request, res: Response) => {
    if (req.headers['x-worker-secret'] !== config.workerSecret) {
        res.status(HTTP_STATUS_UNAUTHORIZED).json({ error: 'Unauthorized' });
        return;
    }

    const { jobId, prompt } = req.body as BriefingRequest;

    if (!jobId || !prompt) {
        res.status(HTTP_STATUS_BAD_REQUEST).json({
            error: 'jobId and prompt are required',
        });
        return;
    }

    console.log(`[Worker] Briefing job received: ${jobId}`);

    const controller = new AbortController();
    activeJobs.set(jobId, controller);

    void processBriefingJob(jobId, prompt, controller)
        .catch(error => {
            console.error(
                `[Worker] Briefing job ${jobId} handler error:`,
                error
            );
        })
        .finally(() => {
            activeJobs.delete(jobId);
        });

    res.json({ status: 'submitted', jobId });
});

async function processBriefingJob(
    jobId: string,
    prompt: string,
    controller: AbortController
): Promise<void> {
    if (controller.signal.aborted || (await isCancelled(jobId))) {
        await cleanupCancelledJob(jobId);
        return;
    }

    await redis.set(`job:${jobId}:status`, 'processing', {
        ex: JOB_TTL_SECONDS,
    });

    try {
        const text = await callBriefingAI(prompt, controller.signal);

        if (!text || text.trim() === '') {
            throw new Error('AI returned an empty response');
        }

        if (controller.signal.aborted || (await isCancelled(jobId))) {
            await cleanupCancelledJob(jobId);
            return;
        }

        // AI가 반환한 JSON 문자열을 그대로 저장 — Upstash가 get 시 자동 파싱하여
        // pollBriefingAction에 RawMarketBriefingResponse 객체로 전달된다.
        // /analyze 엔드포인트와 동일한 패턴.
        await redis.set(`job:${jobId}:result`, text.trim(), {
            ex: JOB_TTL_SECONDS,
        });
        await redis.set(`job:${jobId}:status`, 'done', {
            ex: JOB_TTL_SECONDS,
        });

        console.log(`[Worker] Briefing job ${jobId} completed`);
    } catch (error) {
        if (controller.signal.aborted) {
            await cleanupCancelledJob(jobId);
            return;
        }

        const message =
            error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Briefing job ${jobId} failed:`, message);

        await redis.set(`job:${jobId}:error`, message, {
            ex: JOB_TTL_SECONDS,
        });
        await redis.set(`job:${jobId}:status`, 'error', {
            ex: JOB_TTL_SECONDS,
        });
    }
}

app.listen(config.port, () => {
    console.log(`[Worker] Listening on port ${config.port}`);
});
