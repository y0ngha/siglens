import express from 'express';
import { Redis } from '@upstash/redis';
import { config } from './config.js';
import { callGemini } from './gemini.js';

const JOB_TTL_SECONDS = 600;

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
    const { jobId, prompt } = req.body as AnalyzeRequest;

    if (!jobId || !prompt) {
        res.status(400).json({ error: 'jobId and prompt are required' });
        return;
    }

    console.log(`[Worker] Job received: ${jobId} (prompt: ${(prompt.length / 1024).toFixed(1)}KB)`);

    // Cloud Run은 요청 처리 중에만 CPU를 할당하므로,
    // 응답을 보내지 않고 Gemini 완료까지 요청을 열어둔다.
    void processJob(jobId, prompt)
        .then(() => {
            res.json({ status: 'done', jobId });
        })
        .catch(error => {
            console.error(`[Worker] Job ${jobId} handler error:`, error);
            res.status(500).json({ status: 'error', jobId });
        });
});

async function processJob(jobId: string, prompt: string): Promise<void> {
    await redis.set(`job:${jobId}:status`, 'processing', {
        ex: JOB_TTL_SECONDS,
    });

    try {
        const result = await callGemini(prompt);

        await Promise.all([
            redis.set(`job:${jobId}:result`, result, {
                ex: JOB_TTL_SECONDS,
            }),
            redis.set(`job:${jobId}:status`, 'done', {
                ex: JOB_TTL_SECONDS,
            }),
        ]);

        console.log(`[Worker] Job ${jobId} completed`);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Job ${jobId} failed:`, message);

        await Promise.all([
            redis.set(`job:${jobId}:error`, message, {
                ex: JOB_TTL_SECONDS,
            }),
            redis.set(`job:${jobId}:status`, 'error', {
                ex: JOB_TTL_SECONDS,
            }),
        ]);
    }
}

app.listen(config.port, () => {
    console.log(`[Worker] Listening on port ${config.port}`);
});
