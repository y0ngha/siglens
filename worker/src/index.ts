import { constants } from 'node:http2';
import express from 'express';
import { Redis } from '@upstash/redis';
import { config } from './config.js';
import { callGemini } from './gemini.js';
import { callClaude } from './claude.js';
import { withRetry } from './retry.js';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

const JOB_TTL_SECONDS = 3600;
const AI_RETRY_MAX_ATTEMPTS = 5;
const AI_RETRY_DELAY_MS = 5000;

async function callAI(prompt: string): Promise<string> {
    if (config.aiProvider === 'claude') {
        return callClaude(prompt);
    }

    try {
        return await withRetry(() => callGemini(prompt), {
            maxAttempts: AI_RETRY_MAX_ATTEMPTS,
            baseDelayMs: AI_RETRY_DELAY_MS,
        });
    } catch (error) {
        // 기본 모델 재시도 모두 소진 시 fallback 모델로 1회 시도
        console.warn(
            `[Worker] Primary model (${config.gemini.model}) exhausted. Falling back to ${config.gemini.fallbackModel} with thinking enabled.`
        );
        return withRetry(
            () =>
                callGemini(prompt, {
                    model: config.gemini.fallbackModel,
                    thinking: true,
                }),
            {
                maxAttempts: AI_RETRY_MAX_ATTEMPTS,
                baseDelayMs: AI_RETRY_DELAY_MS,
            }
        );
    }
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
