import type { AgentToolSpec } from '@y0ngha/siglens-core';
import { buildSkillMarkdown } from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';

const quote: AgentToolSpec = {
    name: 'get_quote',
    description: 'Latest price for up to 3 symbols.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: {
                type: 'array',
                description: 'Up to 3 symbols',
                items: { type: 'string' },
            },
        },
        required: ['symbols'],
        additionalProperties: false,
    },
};
const bars: AgentToolSpec = {
    name: 'get_bars_indicators',
    description: 'Recent bars with indicators.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            timeframe: { type: 'string', enum: ['1Hour', '1Day'] },
            bars: { type: 'integer', minimum: 10, maximum: 60 },
        },
        required: ['timeframe'],
        additionalProperties: false,
    },
};
const noArgs: AgentToolSpec = {
    name: 'get_my_portfolio',
    description: 'Your holdings.',
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
};

const build = (tools: readonly AgentToolSpec[]): string =>
    buildSkillMarkdown({ baseUrl: 'https://example.test', tools });

describe('buildSkillMarkdown', () => {
    it('프런트매터에 이름과 설명을 둔다', () => {
        const md = build([quote]);
        expect(md.startsWith('---\nname: siglens\ndescription: ')).toBe(true);
        expect(md).toContain('\n---\n\n# SigLens');
    });

    it('기본 URL로 curl 예시를 만든다', () => {
        const md = build([quote]);
        expect(md).toContain(
            'curl -s -X POST https://example.test/api/v1/tools/<name>'
        );
        expect(md).toContain('Authorization: Bearer $SIGLENS_API_KEY');
    });

    it('도구마다 이름·설명·인자를 스펙 그대로 옮긴다', () => {
        const md = build([quote, bars]);
        expect(md).toContain('### `get_quote`');
        expect(md).toContain('Latest price for up to 3 symbols.');
        expect(md).toContain(
            '- `symbols` (array of string, required): Up to 3 symbols'
        );
        expect(md).toContain('- `timeframe` ("1Hour" | "1Day", required)');
        expect(md).toContain('- `bars` (integer (10..60), optional)');
    });

    it('인자 없는 도구는 빈 객체를 보내라고 안내한다', () => {
        expect(build([noArgs])).toContain('Arguments: none (send `{}`).');
    });

    it('넘긴 도구만 나열한다', () => {
        const md = build([quote]);
        expect(md).toContain('### `get_quote`');
        expect(md).not.toContain('### `get_bars_indicators`');
    });

    it('한도 문구는 설정 상수에서 온다', () => {
        const md = build([quote]);
        expect(md).toContain(
            `${PUBLIC_API_RATE_LIMITS.data.perMinute}/minute, ${PUBLIC_API_RATE_LIMITS.data.perDay.toLocaleString('en-US')}/day`
        );
    });

    it('잘린 결과는 meta.truncated로 알린다고 안내한다', () => {
        const md = build([quote]);
        expect(md).toContain('`meta.truncated: true`');
        expect(md).toContain('"preview"');
    });

    it('한도 헤더는 한도를 세는 응답에만 있다고 정확히 적고, 모든 응답에 있다고 주장하지 않는다', () => {
        const md = build([quote]);
        expect(md).toContain('Every metered response');
        expect(md).toContain('requests rejected before metering');
        expect(md).not.toContain('every response carries');
        expect(md).toContain('per account');
    });

    it('get_news가 저장된 기사만 돌려준다고 밝힌다', () => {
        expect(build([quote])).toContain(
            'only news SigLens has already stored'
        );
    });

    it('run_fresh_analysis가 없으면 BYOK·생성 안내를 싣지 않는다', () => {
        const md = build([quote]);
        expect(md).not.toContain('BYOK');
        expect(md).not.toContain('byok_key_required');
        expect(md).not.toContain('provider_error');
    });

    describe('run_fresh_analysis가 있으면', () => {
        const fresh: AgentToolSpec = {
            ...noArgs,
            name: 'run_fresh_analysis',
            costClass: 'expensive',
        };
        const md = build([quote, fresh]);

        it('캐시는 무료고 생성만 사용자 BYOK 키를 쓴다고 안내한다', () => {
            expect(md).toContain('(BYOK)');
            expect(md).toContain('never spends its own LLM key');
            expect(md).toContain('no LLM call');
            expect(md).toContain('about a minute');
            expect(md).toContain(
                `${FRESH_ANALYSIS_DEADLINE_SECONDS}-second tool deadline`
            );
        });

        it('모든 모델이 사용자 키로 생성되고 서버 키는 쓰지 않는다고 분명히 적는다', () => {
            expect(md).toContain(
                'Every model in the `model` argument list can generate a new analysis, free and member models included'
            );
            expect(md).toContain("SigLens's own LLM key is never used");
            expect(md).not.toContain('premium');
            expect(md).not.toContain('only read the shared cache');
        });

        it('생성은 200 스트림이고 실패도 200 본문의 error 필드로 온다고 안내한다', () => {
            expect(md).toContain('whitespace keepalive bytes');
            expect(md).toContain('Leading whitespace is valid JSON');
            expect(md).toContain('an `error` field means failure even on 200');
            expect(md).toContain(
                'Closing the connection does not cancel the generation'
            );
        });

        it('model 인자와 계정 기본 모델을 안내한다', () => {
            expect(md).toContain('`model`');
            expect(md).toContain('`defaultModel`');
        });

        it('ai 버킷 한도 숫자는 설정 상수에서 온다', () => {
            const { perMinute, perDay } = PUBLIC_API_RATE_LIMITS.ai;
            expect(md).toContain(
                `${perMinute}/minute, ${perDay.toLocaleString('en-US')}/day`
            );
        });

        it.each([
            'model_required',
            'invalid_model',
            'byok_key_required',
            'analysis_failed',
            'rate_limited',
            'provider_error',
        ])('오류 코드 %s를 안내한다', code => {
            expect(md).toContain(`\`${code}\``);
        });
    });
});
