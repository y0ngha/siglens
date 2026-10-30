import { afterEach, describe, expect, it, vi } from 'vitest';
import { logUsage } from '@/entities/llm-provider/api/logUsage';

/** 첫 `console.info` 호출의 단일 문자열 인자를 JSON으로 읽는다. */
function readLoggedLine(info: ReturnType<typeof vi.spyOn>): unknown {
    const [call] = info.mock.calls;
    expect(call).toHaveLength(1);
    return JSON.parse(String(call[0]));
}

describe('logUsage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * core가 분석 경로에서 내보내는 라인과 **동일한 필드명**을 하나의 순수 JSON
     * 객체로 직렬화해야 한다 — `tag`는 CloudWatch JSON 필터(`$.tag = "[Usage]"`)가
     * 매칭하는 마커 필드다. 텍스트에 `[Usage]`가 그대로 남아 있어 core의 2-인자
     * 포맷을 겨냥한 기존 `like /\[Usage\]/` Insights 쿼리도 계속 매치된다.
     */
    it('순수 JSON({tag, jobId, model, ...})으로 직렬화한다', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});

        logUsage({
            jobId: 'chat',
            model: 'claude-opus-5',
            latencyMs: 1234,
            promptTokens: 10,
            cachedTokens: 5,
            cacheWriteTokens: 2,
            outputTokens: 7,
        });

        expect(info).toHaveBeenCalledTimes(1);
        expect(readLoggedLine(info)).toEqual({
            tag: '[Usage]',
            jobId: 'chat',
            model: 'claude-opus-5',
            latencyMs: 1234,
            promptTokens: 10,
            cachedTokens: 5,
            cacheWriteTokens: 2,
            outputTokens: 7,
        });
    });

    it('API 키·프롬프트·사용자 식별자 필드를 포함하지 않는다', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});

        logUsage({
            jobId: 'agent',
            model: 'deepseek-chat',
            latencyMs: 500,
            promptTokens: 1,
            cachedTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 1,
        });

        const parsed = readLoggedLine(info);
        for (const forbidden of [
            'apiKey',
            'prompt',
            'promptText',
            'userId',
            'message',
        ]) {
            expect(parsed).not.toHaveProperty(forbidden);
        }
    });
});
