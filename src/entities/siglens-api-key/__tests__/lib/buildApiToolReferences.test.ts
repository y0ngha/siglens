import type { AgentToolSpec } from '@y0ngha/siglens-core';
import { API_GENERATABLE_MODELS } from '@/entities/siglens-api-key/lib/apiModels';
import {
    buildApiToolReference,
    buildApiToolReferences,
    buildCurlExample,
    exampleArgumentsFor,
} from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';

const spec = (
    name: string,
    properties: AgentToolSpec['inputSchema']['properties'],
    required?: string[]
): AgentToolSpec => ({
    name,
    description: `${name} description`,
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties,
        ...(required === undefined ? {} : { required }),
        additionalProperties: false,
    },
});

describe('exampleArgumentsFor', () => {
    it('builds required arguments only, with values the schema accepts', () => {
        const tool = spec(
            'get_bars_indicators',
            {
                symbol: { type: 'string' },
                timeframe: { type: 'string', enum: ['5Min', '1Day'] },
                bars: { type: 'integer', minimum: 10, maximum: 60 },
            },
            ['symbol', 'timeframe']
        );
        expect(exampleArgumentsFor(tool)).toEqual({
            symbol: 'AAPL',
            timeframe: '1Day',
        });
    });

    it('wraps symbol arrays and picks the first enum value when 1Day is absent', () => {
        const tool = spec(
            'x',
            {
                symbols: { type: 'array', items: { type: 'string' } },
                market: { type: 'string', enum: ['us', 'kr'] },
                count: { type: 'integer', minimum: 3 },
                flag: { type: 'boolean' },
            },
            ['symbols', 'market', 'count', 'flag']
        );
        expect(exampleArgumentsFor(tool)).toEqual({
            symbols: ['AAPL'],
            market: 'us',
            count: 3,
            flag: true,
        });
    });

    it('returns {} for a tool without required arguments', () => {
        expect(exampleArgumentsFor(spec('get_economy', {}))).toEqual({});
    });

    it('overrides query-style tools with meaningful values', () => {
        const query = { query: { type: 'string' as const } };
        expect(
            exampleArgumentsFor(spec('search_ticker', query, ['query']))
        ).toEqual({ query: 'apple' });
        expect(
            exampleArgumentsFor(spec('get_guide', query, ['query']))
        ).toEqual({ query: 'MACD' });
    });

    it('adds a generatable model for run_fresh_analysis only when the spec has the argument', () => {
        const base = {
            symbol: { type: 'string' as const },
            kind: { type: 'string' as const, enum: ['technical', 'news'] },
        };
        expect(
            exampleArgumentsFor(
                spec('run_fresh_analysis', base, ['symbol', 'kind'])
            )
        ).toEqual({ symbol: 'AAPL', kind: 'technical' });
        expect(
            exampleArgumentsFor(
                spec(
                    'run_fresh_analysis',
                    { ...base, model: { type: 'string' } },
                    ['symbol', 'kind']
                )
            )
        ).toEqual({
            symbol: 'AAPL',
            kind: 'technical',
            model: API_GENERATABLE_MODELS[0],
        });
    });
});

describe('buildCurlExample', () => {
    it('uses the SIGLENS_API_KEY variable and the JSON body', () => {
        expect(
            buildCurlExample('https://x.test/api/v1/tools/a', { q: 1 })
        ).toBe(
            [
                'curl -s -X POST https://x.test/api/v1/tools/a \\',
                '  -H "Authorization: Bearer $SIGLENS_API_KEY" \\',
                '  -H "Content-Type: application/json" \\',
                `  -d '{"q":1}'`,
            ].join('\n')
        );
    });
});

describe('buildCurlExample --max-time', () => {
    it('adds --max-time only when asked', () => {
        expect(buildCurlExample('https://x.test/a', {})).toMatch(
            /^curl -s -X POST/
        );
        expect(
            buildCurlExample('https://x.test/a', {}, { maxTimeSeconds: 42 })
        ).toMatch(/^curl -s --max-time 42 -X POST/);
    });
});

describe('buildApiToolReference', () => {
    const fresh = spec('run_fresh_analysis', { symbol: { type: 'string' } }, [
        'symbol',
    ]);

    it('builds one tool reference, the same as the list builder does', () => {
        const single = buildApiToolReference({
            baseUrl: 'https://x.test',
            tool: fresh,
        });
        expect(
            buildApiToolReferences({
                baseUrl: 'https://x.test',
                tools: [fresh],
            })
        ).toEqual([single]);
    });

    it('gives only the BYOK generation tool the deadline-bound --max-time', () => {
        const base = 'https://x.test';
        expect(
            buildApiToolReference({ baseUrl: base, tool: fresh }).curl
        ).toContain(`--max-time ${FRESH_ANALYSIS_DEADLINE_SECONDS}`);
        expect(
            buildApiToolReference({
                baseUrl: base,
                tool: spec('get_economy', {}),
            }).curl
        ).not.toContain('--max-time');
    });
});

describe('buildApiToolReferences', () => {
    const tools = [
        spec(
            'get_quote',
            {
                symbols: {
                    type: 'array',
                    description: 'Up to 3',
                    items: { type: 'string' },
                },
            },
            ['symbols']
        ),
        spec('run_fresh_analysis', { symbol: { type: 'string' } }, ['symbol']),
    ];
    const refs = buildApiToolReferences({
        baseUrl: 'https://x.test',
        tools,
    });

    it('keeps the tool order and builds the path and url', () => {
        expect(refs.map(r => r.name)).toEqual([
            'get_quote',
            'run_fresh_analysis',
        ]);
        expect(refs[0]?.path).toBe('/tools/get_quote');
        expect(refs[0]?.url).toBe('https://x.test/api/v1/tools/get_quote');
        expect(refs[0]?.curl).toContain(refs[0]?.url);
    });

    it('describes arguments with a readable type label and the required flag', () => {
        expect(refs[0]?.arguments).toEqual([
            {
                name: 'symbols',
                type: 'array of string',
                required: true,
                description: 'Up to 3',
            },
        ]);
    });

    it('flags only run_fresh_analysis as BYOK', () => {
        expect(refs.map(r => r.byok)).toEqual([false, true]);
    });
});
