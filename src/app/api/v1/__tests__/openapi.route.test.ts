vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    // 실행기가 가진 도구 전부(제외 대상 포함) — 제외는 publicApiTools(실물)가 맡는다.
    availableToolNames: () =>
        new Set([
            'search_ticker',
            'get_quote',
            'get_bars_indicators',
            'get_cached_analysis',
            'get_news',
            'get_options_summary',
            'get_fundamentals',
            'get_market_overview',
            'get_economy',
            'get_congress_trades',
            'get_investor_flows',
            'get_guide',
            'get_my_portfolio',
            'run_fresh_analysis',
            'web_search',
        ]),
    createToolExecutor: vi.fn(),
}));
const failure = vi.hoisted(() => ({ on: false }));
vi.mock(
    '@/entities/siglens-api-key/lib/buildOpenApiDocument',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@/entities/siglens-api-key/lib/buildOpenApiDocument')
            >();
        return {
            ...actual,
            buildOpenApiDocument: (
                ...args: Parameters<typeof actual.buildOpenApiDocument>
            ) => {
                if (failure.on) throw new Error('boom');
                return actual.buildOpenApiDocument(...args);
            },
        };
    }
);
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://example.test' }));

import { parse } from 'yaml';
import { GET as getJson } from '@/app/api/v1/openapi.json/route';
import { GET as getYaml } from '@/app/api/v1/openapi.yaml/route';
import { OPENAPI_CACHE_CONTROL } from '@/app/api/v1/openApiDocument';
import { publicApiToolSpecs } from '@/app/api/v1/publicApiTools';

type Json = { paths: Record<string, unknown>; servers: { url: string }[] };

const toolPaths = (doc: Json): string[] =>
    Object.keys(doc.paths).filter(path => path.startsWith('/tools/'));

describe('GET /api/v1/openapi.json', () => {
    it('serves the document without authentication and with a public cache header', async () => {
        const response = await getJson();
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain(
            'application/json'
        );
        expect(response.headers.get('Cache-Control')).toBe(
            OPENAPI_CACHE_CONTROL
        );
        expect(response.headers.get('Cache-Control')).toMatch(/^public, /);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('lists exactly the exposed tools (same source as SKILL.md and /tools)', async () => {
        const doc = (await (await getJson()).json()) as Json;
        const exposed = publicApiToolSpecs().map(spec => `/tools/${spec.name}`);
        expect(toolPaths(doc)).toEqual(exposed);
        expect(exposed).toHaveLength(14);
    });

    it('exposes get_investor_flows as a data tool: symbol input, no model argument (no server LLM)', async () => {
        const doc = (await (await getJson()).json()) as Json;
        expect(toolPaths(doc)).toContain('/tools/get_investor_flows');
        const operation = JSON.stringify(
            doc.paths['/tools/get_investor_flows']
        );
        expect(operation).toContain('Investor flows');
        expect(operation).not.toContain('"model"');
    });

    it('leaves web_search out although the executor has it, and keeps run_fresh_analysis with its BYOK notes', async () => {
        const doc = (await (await getJson()).json()) as Json;
        expect(Object.keys(doc.paths)).not.toContain('/tools/web_search');
        const fresh = JSON.stringify(doc.paths['/tools/run_fresh_analysis']);
        expect(fresh).toContain('BYOK');
        expect(fresh).toContain('SigLens never spends its own LLM key');
        // 설명문이 다른 도구를 언급할 수는 있다(에이전트용 문장 그대로) — 호출 가능한 오퍼레이션이 없다는 뜻이다.
        expect(JSON.stringify(doc)).not.toContain('"operationId":"web_search"');
    });

    it('takes the server URL from the site URL setting', async () => {
        const doc = (await (await getJson()).json()) as Json;
        expect(doc.servers[0]?.url).toBe('https://example.test/api/v1');
    });
});

describe('GET /api/v1/openapi.yaml', () => {
    it('serves YAML with the same cache policy', async () => {
        const response = await getYaml();
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe(
            'application/yaml; charset=utf-8'
        );
        expect(response.headers.get('Cache-Control')).toBe(
            OPENAPI_CACHE_CONTROL
        );
    });

    it('is the same document as the JSON one: one path per exposed tool, top-level keys in order', async () => {
        const yaml = await (await getYaml()).text();
        expect(yaml.startsWith('openapi: "3.1.0"\n')).toBe(true);
        for (const spec of publicApiToolSpecs())
            expect(yaml).toContain(`\n  "/tools/${spec.name}":\n`);
        expect(yaml).not.toContain('"/tools/web_search"');
        const keys = [...yaml.matchAll(/^([a-zA-Z]+):/gm)].map(m => m[1]);
        expect(keys).toEqual([
            'openapi',
            'info',
            'servers',
            'externalDocs',
            'security',
            'tags',
            'paths',
            'components',
        ]);
    });

    it('parses back to exactly the JSON document (real exposed tools)', async () => {
        const json = await (await getJson()).json();
        const yaml = await (await getYaml()).text();
        expect(parse(yaml)).toEqual(json);
    });
});

describe('openapi routes when generation fails', () => {
    afterEach(() => {
        failure.on = false;
    });

    it.each([
        ['openapi.json', getJson],
        ['openapi.yaml', getYaml],
    ])(
        '%s answers a generic 500 envelope that browsers can still read (CORS on errors)',
        async (_name, get) => {
            failure.on = true;
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const response = await get();
            errorSpy.mockRestore();
            expect(response.status).toBe(500);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*'
            );
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            const body = (await response.json()) as {
                error: { code: string; message: string };
            };
            expect(body.error.code).toBe('internal_error');
            // 내부 오류 내용은 싣지 않는다.
            expect(JSON.stringify(body)).not.toContain('boom');
        }
    );
});
