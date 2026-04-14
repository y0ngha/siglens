import { constants } from 'node:http2';
import express from 'express';
import { Redis } from '@upstash/redis';
import { config } from './config.js';
import { callGemini, MAX_TOKENS_CODE } from './gemini.js';
import { callClaude } from './claude.js';
import { withRetry } from './retry.js';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

const JOB_TTL_SECONDS = 3600;
const AI_RETRY_MAX_ATTEMPTS = 5;
const AI_RETRY_MAX_ATTEMPTS_FREE = 3;
const AI_RETRY_DELAY_MS = 5000;

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

/**
 * MAX_TOKENS 발생 시 시도할 thinkingBudget 단계.
 * initial → initial/2 → 8192 → 4096 → 2048 → 0(thinking off)
 * 엄격한 감소 순서를 보장하기 위해 이전 값보다 작은 경우만 포함한다.
 */
function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [initial, Math.floor(initial / 2), 8192, 4096, 2048, 0];
    const result: number[] = [];
    for (const budget of candidates) {
        if (result.length === 0 || budget < result[result.length - 1]) {
            result.push(budget);
        }
    }
    return result;
}

/**
 * MAX_TOKENS 발생 시 thinkingBudget을 단계적으로 낮춰가며 1회씩 시도한다.
 * 429/5xx 등 일시적 에러는 재시도하지 않고 그대로 throw하여
 * 외부 withRetry 레이어에서 처리하도록 한다.
 */
async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string
): Promise<string> {
    const budgets = getThinkingBudgetSequence(config.gemini.thinkingBudget);

    for (const budget of budgets) {
        try {
            return await callGemini(prompt, {
                apiKey,
                model: config.gemini.model,
                thinking: budget > 0,
                thinkingBudget: budget,
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
    maxAttempts: number = AI_RETRY_MAX_ATTEMPTS
): Promise<string> {
    return withRetry(() => callGeminiReducingBudget(prompt, apiKey), {
        maxAttempts,
        baseDelayMs: AI_RETRY_DELAY_MS,
    });
    // TODO: fallback model 임시 비활성화
    // free API key의 할당량이 key 단위로 공유되어 fallback도 즉시 실패하는 문제 확인 필요
    // try {
    //     return await withRetry(() => callGeminiReducingBudget(prompt, apiKey), ...);
    // } catch {
    //     return withRetry(() => callGeminiReducingBudget(prompt, apiKey, fallbackModel), ...);
    // }
}

async function callAI(prompt: string): Promise<string> {
    if (config.aiProvider === 'claude') {
        return callClaude(prompt);
    }

    const { freeApiKey, apiKey } = config.gemini;

    if (freeApiKey) {
        try {
            return await callGeminiWithFallback(
                prompt,
                freeApiKey,
                AI_RETRY_MAX_ATTEMPTS_FREE
            );
        } catch {
            console.warn(
                '[Worker] Free API key exhausted. Switching to paid key.'
            );
        }
    }

    return callGeminiWithFallback(prompt, apiKey);
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

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/analyze', (req, res) => {
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

    // Cloud Run은 요청 처리 중에만 CPU를 할당하므로,
    // 응답을 보내지 않고 Gemini 완료까지 요청을 열어둔다.
    void processJob(jobId, prompt)
        .then(() => {
            res.json({ status: 'done', jobId });
        })
        .catch(error => {
            console.error(`[Worker] Job ${jobId} handler error:`, error);
            res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
                status: 'error',
                jobId,
            });
        });
});

async function processJob(jobId: string, prompt: string): Promise<void> {
    await redis.set(`job:${jobId}:status`, 'processing', {
        ex: JOB_TTL_SECONDS,
    });

    try {
        const result = await callAI(prompt);

        if (!result || result.trim() === '') {
            throw new Error('AI returned an empty response');
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

app.listen(config.port, () => {
    console.log(`[Worker] Listening on port ${config.port}`);
});
