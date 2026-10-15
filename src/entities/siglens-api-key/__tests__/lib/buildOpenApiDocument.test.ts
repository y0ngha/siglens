import type { AgentToolSpec } from '@y0ngha/siglens-core';
import {
    buildOpenApiDocument,
    OPENAPI_VERSION,
    type OpenApiDocument,
} from '@/entities/siglens-api-key/lib/buildOpenApiDocument';
import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import {
    LOCALE_HEADER_DOC_NAME,
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_DOC_PATHS,
    PUBLIC_API_RATE_LIMITS,
} from '@/shared/config/publicApi';
import { USER_TIER_VALUES } from '@/shared/db/constants';
import { ANALYSIS_LOCALE_HEADER, LOCALES } from '@/shared/i18n/locales';

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
            symbol: { type: 'string', description: 'Ticker' },
            timeframe: { type: 'string', enum: ['1Hour', '1Day'] },
            bars: {
                type: 'integer',
                minimum: 10,
                maximum: 60,
                description: '',
            },
        },
        required: ['symbol', 'timeframe'],
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
const fresh: AgentToolSpec = {
    name: 'run_fresh_analysis',
    description: 'Get an AI analysis for a symbol.',
    costClass: 'expensive',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string' },
            kind: { type: 'string', enum: ['technical', 'news'] },
            model: { type: 'string', enum: ['model-a', 'model-b'] },
        },
        required: ['symbol', 'kind'],
        additionalProperties: false,
    },
};

const BASE_URL = 'https://example.test';
const tools = [quote, bars, noArgs, fresh];
const build = (list: readonly AgentToolSpec[] = tools): OpenApiDocument =>
    buildOpenApiDocument({ baseUrl: BASE_URL, tools: list });

type Obj = Record<string, unknown>;
const at = (doc: unknown, ...keys: string[]): Obj =>
    keys.reduce<unknown>((node, key) => (node as Obj)[key], doc) as Obj;

/** 문서 안의 모든 `$ref` 값을 모은다. */
function collectRefs(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(collectRefs);
    if (typeof node !== 'object' || node === null) return [];
    return Object.entries(node).flatMap(([key, value]) =>
        key === '$ref' && typeof value === 'string'
            ? [value]
            : collectRefs(value)
    );
}

/** `#/components/schemas/X` 같은 JSON 포인터를 문서에서 따라간다. */
function resolvePointer(doc: unknown, pointer: string): unknown {
    return pointer
        .replace(/^#\//, '')
        .split('/')
        .reduce<unknown>((node, key) => (node as Obj | undefined)?.[key], doc);
}

describe('buildOpenApiDocument — structure (OpenAPI 3.1 sanity)', () => {
    const doc = build();

    it('declares 3.1, info, servers, paths and components', () => {
        expect(doc.openapi).toBe(OPENAPI_VERSION);
        expect(doc.openapi).toMatch(/^3\.1\.\d+$/);
        expect(doc.info).toMatchObject({ title: 'SigLens API' });
        expect(typeof doc.info.version).toBe('string');
        expect(doc.servers).toEqual([
            {
                url: `${BASE_URL}${PUBLIC_API_BASE_PATH}`,
                description: 'SigLens',
            },
        ]);
        expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
        expect(doc.components).toHaveProperty('securitySchemes');
    });

    it('every $ref resolves inside the document', () => {
        const refs = collectRefs(doc);
        expect(refs.length).toBeGreaterThan(20);
        for (const pointer of refs) {
            expect(pointer.startsWith('#/')).toBe(true);
            expect(
                resolvePointer(doc, pointer),
                `${pointer} should exist`
            ).toBeDefined();
        }
    });

    it('every path starts with a slash and has a unique operationId', () => {
        const ids: string[] = [];
        for (const [path, item] of Object.entries(doc.paths)) {
            expect(path.startsWith('/')).toBe(true);
            for (const [method, operation] of Object.entries(item as Obj)) {
                expect(['get', 'post']).toContain(method);
                const op = operation as Obj;
                expect(typeof op.operationId).toBe('string');
                ids.push(op.operationId as string);
                expect(op.responses).toBeDefined();
                expect(Object.keys(op.responses as Obj)).toContain('200');
            }
        }
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses only object-typed responses whose keys are HTTP statuses', () => {
        for (const item of Object.values(doc.paths)) {
            for (const operation of Object.values(item as Obj)) {
                for (const status of Object.keys(
                    (operation as Obj).responses as Obj
                ))
                    expect(status).toMatch(/^[1-5]\d\d$/);
            }
        }
    });

    it('is JSON-serializable without loss', () => {
        expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    });
});

describe('buildOpenApiDocument — security', () => {
    const doc = build();

    it('declares bearer auth and requires it globally', () => {
        expect(
            at(doc.components, 'securitySchemes', 'bearerAuth')
        ).toMatchObject({ type: 'http', scheme: 'bearer' });
        expect(doc.security).toEqual([{ bearerAuth: [] }]);
    });

    it('opens only the documentation paths to unauthenticated calls', () => {
        for (const path of Object.values(PUBLIC_API_DOC_PATHS))
            expect(at(doc.paths, path, 'get').security).toEqual([]);
        for (const path of ['/me', '/tools', '/tools/get_quote'])
            expect(
                (doc.paths[path] as Obj).get ?? (doc.paths[path] as Obj).post
            ).not.toHaveProperty('security');
    });
});

describe('buildOpenApiDocument — paths', () => {
    const doc = build();

    it('documents /me, /tools, the doc routes and one POST path per tool', () => {
        const paths = Object.keys(doc.paths);
        expect(paths).toEqual([
            '/me',
            '/tools',
            '/tools/get_quote',
            '/tools/get_bars_indicators',
            '/tools/get_my_portfolio',
            '/tools/run_fresh_analysis',
            ...Object.values(PUBLIC_API_DOC_PATHS),
        ]);
        for (const tool of tools)
            expect(at(doc.paths, `/tools/${tool.name}`)).toHaveProperty('post');
    });

    it('lists exactly the tools it was given (new tools appear automatically)', () => {
        const extra: AgentToolSpec = {
            ...noArgs,
            name: 'get_brand_new_thing',
        };
        const toolPaths = Object.keys(build([quote, extra]).paths).filter(p =>
            p.startsWith('/tools/')
        );
        expect(toolPaths).toEqual([
            '/tools/get_quote',
            '/tools/get_brand_new_thing',
        ]);
    });

    it('never invents a web_search path unless it is given', () => {
        expect(Object.keys(doc.paths)).not.toContain('/tools/web_search');
    });

    it('turns the inputSchema into the request body', () => {
        const body = at(
            doc.paths,
            '/tools/get_bars_indicators',
            'post',
            'requestBody'
        );
        expect(body.required).toBe(true);
        const schema = at(body, 'content', 'application/json', 'schema');
        expect(schema).toEqual({
            type: 'object',
            properties: {
                symbol: { type: 'string', description: 'Ticker' },
                timeframe: { type: 'string', enum: ['1Hour', '1Day'] },
                // 빈 description은 싣지 않는다.
                bars: { type: 'integer', minimum: 10, maximum: 60 },
            },
            required: ['symbol', 'timeframe'],
            additionalProperties: false,
        });
        expect(at(body, 'content', 'application/json').example).toEqual({
            symbol: 'AAPL',
            timeframe: '1Day',
        });
    });

    it('keeps array item schemas', () => {
        const schema = at(
            doc.paths,
            '/tools/get_quote',
            'post',
            'requestBody',
            'content',
            'application/json',
            'schema'
        );
        expect(at(schema, 'properties', 'symbols')).toEqual({
            type: 'array',
            description: 'Up to 3 symbols',
            items: { type: 'string' },
        });
    });

    it('marks the body optional for a tool without arguments', () => {
        const body = at(
            doc.paths,
            '/tools/get_my_portfolio',
            'post',
            'requestBody'
        );
        expect(body.required).toBe(false);
        expect(
            at(body, 'content', 'application/json', 'schema').required
        ).toBeUndefined();
    });

    it('uses the tool name as the operationId and the tool description', () => {
        const op = at(doc.paths, '/tools/get_quote', 'post');
        expect(op.operationId).toBe('get_quote');
        expect(op.description).toBe(quote.description);
        expect(op.parameters).toEqual([
            { $ref: '#/components/parameters/SiglensLocale' },
        ]);
    });

    it('describes the locale header with every locale and the default', () => {
        const locale = at(doc.components, 'parameters', 'SiglensLocale');
        expect(locale).toMatchObject({
            name: 'X-Siglens-Locale',
            in: 'header',
            required: false,
        });
        expect(LOCALE_HEADER_DOC_NAME.toLowerCase()).toBe(
            ANALYSIS_LOCALE_HEADER
        );
        expect(at(locale, 'schema').enum).toEqual([...LOCALES]);
        expect(at(locale, 'schema').default).toBe('ko');
    });
});

describe('buildOpenApiDocument — run_fresh_analysis', () => {
    const doc = build();
    const op = at(doc.paths, '/tools/run_fresh_analysis', 'post');

    it('carries the BYOK and streaming notes on the operation', () => {
        const description = op.description as string;
        expect(description).toContain('(BYOK)');
        expect(description).toContain('SigLens never spends its own key');
        expect(description).toContain('`byok_key_required`');
        expect(description).toContain('whitespace keepalive');
        expect(description).toContain(
            `${PUBLIC_API_RATE_LIMITS.ai.perMinute}/minute`
        );
        expect(op['x-byok']).toBe(true);
    });

    it('describes the 200 stream, its error field and the AI rate-limit headers', () => {
        const ok = at(op, 'responses', '200');
        expect(ok.description).toContain('HTTP 200');
        expect(ok.description).toContain('`error` field');
        expect(Object.keys(at(ok, 'headers'))).toEqual(
            expect.arrayContaining([
                'X-RateLimit-Limit',
                'X-RateLimit-AI-Limit',
                'X-RateLimit-AI-Remaining',
                'X-RateLimit-AI-Reset',
            ])
        );
        const oneOf = at(ok, 'content', 'application/json', 'schema')
            .oneOf as Obj[];
        expect(oneOf.map(item => item.$ref)).toEqual([
            '#/components/schemas/ToolSuccess',
            '#/components/schemas/ErrorResponse',
        ]);
    });

    it('lists the BYOK error codes in its 400 and 503 responses', () => {
        expect(at(op, 'responses', '400')).toEqual({
            $ref: '#/components/responses/FreshAnalysisError400',
        });
        const bad = at(doc.components, 'responses', 'FreshAnalysisError400');
        for (const code of [
            'model_required',
            'byok_key_required',
            'byok_model_required',
        ])
            expect(bad.description).toContain(`\`${code}\``);
        expect(
            at(doc.components, 'responses', 'FreshAnalysisError503').description
        ).toContain('`busy`');
    });

    it('does not put BYOK notes on the other tools', () => {
        const other = at(doc.paths, '/tools/get_quote', 'post');
        expect(other.description).not.toContain('BYOK');
        expect(other['x-byok']).toBeUndefined();
        expect(at(other, 'responses', '200', 'headers')).not.toHaveProperty(
            'X-RateLimit-AI-Limit'
        );
    });

    it('gives the example body a model when the spec has the model argument', () => {
        const example = at(op, 'requestBody', 'content', 'application/json')
            .example as Obj;
        expect(example).toMatchObject({ symbol: 'AAPL', kind: 'technical' });
        expect(typeof example.model).toBe('string');
    });
});

describe('buildOpenApiDocument — errors and headers', () => {
    const doc = build();

    it('documents every cataloged error code once in the components', () => {
        const text = JSON.stringify(at(doc.components, 'responses'));
        for (const { code } of API_ERROR_DOCS)
            expect(text, code).toContain(`\`${code}\``);
    });

    it('wires error statuses to ref responses, with rate-limit headers on 429', () => {
        const toolPost = at(doc.paths, '/tools/get_quote', 'post');
        const statuses = Object.keys(at(toolPost, 'responses'));
        expect(statuses).toEqual(
            expect.arrayContaining([
                '200',
                '400',
                '401',
                '404',
                '413',
                '429',
                '500',
                '503',
                '504',
            ])
        );
        const limited = at(doc.components, 'responses', 'ToolError429');
        expect(Object.keys(at(limited, 'headers'))).toEqual(
            expect.arrayContaining([
                'Retry-After',
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-RateLimit-Reset',
            ])
        );
        expect(
            at(doc.components, 'responses', 'ToolError401').headers
        ).toHaveProperty('WWW-Authenticate');
    });

    it('claims streaming only for run_fresh_analysis, not for the shared tool errors', () => {
        const components = at(doc.components, 'responses');
        for (const status of ['500', '504']) {
            expect(
                at(components, `ToolError${status}`).description
            ).not.toContain('streamed');
            expect(
                at(components, `FreshAnalysisError${status}`).description
            ).toContain('streamed (HTTP 200) body');
        }
        // 일반 도구의 오퍼레이션은 공유 ToolError만 가리킨다.
        expect(
            at(doc.paths, '/tools/get_quote', 'post', 'responses', '500')
        ).toEqual({
            $ref: '#/components/responses/ToolError500',
        });
        expect(
            at(
                doc.paths,
                '/tools/run_fresh_analysis',
                'post',
                'responses',
                '500'
            )
        ).toEqual({ $ref: '#/components/responses/FreshAnalysisError500' });
    });

    it('does not give /me tool-only statuses', () => {
        const statuses = Object.keys(at(doc.paths, '/me', 'get', 'responses'));
        expect(statuses).not.toContain('404');
        expect(statuses).not.toContain('413');
        expect(statuses).toContain('401');
    });

    it('defines the error envelope and the rate-limit headers', () => {
        const error = at(doc.components, 'schemas', 'ErrorResponse');
        expect(error.required).toEqual(['error']);
        expect(Object.keys(at(doc.components, 'headers'))).toEqual(
            expect.arrayContaining([
                'RateLimitLimit',
                'RateLimitRemaining',
                'RateLimitReset',
                'AiRateLimitLimit',
                'RetryAfter',
            ])
        );
    });

    it('takes the numbers from the shared constants, not from typed copy', () => {
        const info = doc.info.description as string;
        expect(info).toContain(
            `${PUBLIC_API_RATE_LIMITS.data.perMinute}/minute`
        );
        expect(info).toContain(
            PUBLIC_API_RATE_LIMITS.data.perDay.toLocaleString('en-US')
        );
        expect(
            at(doc.components, 'headers', 'RateLimitLimit').description
        ).toContain(`${PUBLIC_API_RATE_LIMITS.data.perMinute}/minute`);
    });

    it('derives the tier enum from the tier source of truth and cites the sourced deadline', () => {
        const me = at(doc.components, 'schemas', 'MeResponse');
        const tier = at(at(at(me, 'properties', 'data'), 'properties'), 'tier');
        expect(tier.enum).toEqual([...USER_TIER_VALUES]);
        const fresh = JSON.stringify(doc.paths['/tools/run_fresh_analysis']);
        expect(fresh).toContain(
            `${FRESH_ANALYSIS_DEADLINE_SECONDS}-second tool deadline`
        );
        expect(fresh).not.toContain('30-250');
    });

    it('never leaks anything that looks like a secret', () => {
        expect(JSON.stringify(doc)).not.toMatch(/slk_[A-Za-z0-9]{10,}/);
    });
});
