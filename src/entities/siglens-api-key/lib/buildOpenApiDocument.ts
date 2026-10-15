import type { AgentToolSpec, JsonSchemaProperty } from '@y0ngha/siglens-core';
import {
    API_ERROR_DOCS,
    type ApiErrorDoc,
    type ApiErrorScope,
} from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import {
    buildApiToolReferences,
    type ApiToolReference,
} from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import {
    FRESH_ANALYSIS_TOOL,
    renderFreshAnalysisNotes,
    renderLimits,
} from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import {
    API_KEY_PREFIX,
    LOCALE_HEADER_DOC_NAME,
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_DOC_PATHS,
    PUBLIC_API_MAX_BODY_CHARS,
    PUBLIC_API_RATE_LIMITS,
} from '@/shared/config/publicApi';
import { DEFAULT_LOCALE, LOCALES } from '@/shared/i18n/locales';
import type { YamlValue } from '@/shared/lib/toYaml';

export const OPENAPI_VERSION = '3.1.0';

/** `info.version` — API 계약의 버전이다(경로 접두 `/v1`과 함께 움직인다). 앱 버전이 아니다. */
export const OPENAPI_API_VERSION = '1.0.0';

export type OpenApiObject = { [key: string]: YamlValue | undefined };

export interface OpenApiDocument extends OpenApiObject {
    openapi: string;
    info: OpenApiObject;
    servers: YamlValue[];
    security: YamlValue[];
    tags: YamlValue[];
    paths: OpenApiObject;
    components: OpenApiObject;
}

export interface BuildOpenApiDocumentInput {
    /** 사이트 origin(끝 슬래시 없음). 예: `https://siglens.io` */
    baseUrl: string;
    /** 실제로 노출하는 도구 스펙만. 여기 없는 도구는 문서에도 없다(SKILL.md·`/tools`와 같은 소스). */
    tools: readonly AgentToolSpec[];
}

const BEARER_SCHEME = 'bearerAuth';

const ref = (target: string): OpenApiObject => ({
    $ref: `#/components/${target}`,
});

const JSON_CONTENT = 'application/json';

// ─── 오류 응답 ──────────────────────────────────────────────────────────────

/** 오류 응답 묶음. 이름 접두가 `components.responses`의 키가 된다. */
interface ErrorGroup {
    readonly prefix: 'Account' | 'Tool' | 'FreshAnalysis';
    readonly scopes: readonly ApiErrorScope[];
}

const ACCOUNT_ERRORS: ErrorGroup = { prefix: 'Account', scopes: ['all'] };
const TOOL_ERRORS: ErrorGroup = {
    prefix: 'Tool',
    scopes: ['all', 'tools'],
};
const FRESH_ANALYSIS_ERRORS: ErrorGroup = {
    prefix: 'FreshAnalysis',
    scopes: ['all', 'tools', 'fresh-analysis'],
};
const ERROR_GROUPS: readonly ErrorGroup[] = [
    ACCOUNT_ERRORS,
    TOOL_ERRORS,
    FRESH_ANALYSIS_ERRORS,
];

function docsFor(group: ErrorGroup): ApiErrorDoc[] {
    return API_ERROR_DOCS.filter(doc => group.scopes.includes(doc.scope));
}

function statusesOf(group: ErrorGroup): number[] {
    return [...new Set(docsFor(group).map(doc => doc.status))].toSorted(
        (a, b) => a - b
    );
}

const errorResponseName = (group: ErrorGroup, status: number): string =>
    `${group.prefix}Error${status}`;

const RATE_LIMIT_HEADER_REFS: OpenApiObject = {
    'X-RateLimit-Limit': ref('headers/RateLimitLimit'),
    'X-RateLimit-Remaining': ref('headers/RateLimitRemaining'),
    'X-RateLimit-Reset': ref('headers/RateLimitReset'),
};

/** 상태별로 함께 나가는 헤더. */
function errorHeaders(status: number): OpenApiObject | undefined {
    switch (status) {
        case 401:
            return {
                'WWW-Authenticate': {
                    description: 'Always `Bearer`.',
                    schema: { type: 'string' },
                },
            };
        case 429:
            return {
                'Retry-After': ref('headers/RetryAfter'),
                ...RATE_LIMIT_HEADER_REFS,
            };
        case 503:
            return { 'Retry-After': ref('headers/RetryAfter') };
        default:
            return undefined;
    }
}

function buildErrorResponse(group: ErrorGroup, status: number): OpenApiObject {
    const matching = docsFor(group).filter(doc => doc.status === status);
    const lines = matching.map(
        doc =>
            `- \`${doc.code}\`: ${doc.summary}${doc.streamed === true && group === FRESH_ANALYSIS_ERRORS ? ' Inside a streamed (HTTP 200) body it appears as the `error` field.' : ''}`
    );
    return {
        description: lines.join('\n'),
        headers: errorHeaders(status),
        content: {
            [JSON_CONTENT]: {
                schema: ref('schemas/ErrorResponse'),
                example: {
                    error: {
                        code: matching[0]?.code ?? 'internal_error',
                        message: 'Human-readable English message.',
                    },
                },
            },
        },
    };
}

function buildErrorResponses(): OpenApiObject {
    return Object.fromEntries(
        ERROR_GROUPS.flatMap(group =>
            statusesOf(group).map(status => [
                errorResponseName(group, status),
                buildErrorResponse(group, status),
            ])
        )
    );
}

/** 그룹의 오류 상태 전부를 `$ref`로 가리키는 `responses` 조각. */
function errorRefs(group: ErrorGroup): OpenApiObject {
    return Object.fromEntries(
        statusesOf(group).map(status => [
            String(status),
            ref(`responses/${errorResponseName(group, status)}`),
        ])
    );
}

// ─── 도구 → 요청 본문 스키마 ────────────────────────────────────────────────

function propertySchema(prop: JsonSchemaProperty): OpenApiObject {
    return {
        type: prop.type,
        // 빈 설명은 문서에 노이즈다.
        description: prop.description === '' ? undefined : prop.description,
        enum: prop.enum === undefined ? undefined : [...prop.enum],
        minimum: prop.minimum,
        maximum: prop.maximum,
        items:
            prop.items === undefined ? undefined : propertySchema(prop.items),
    };
}

/** core의 `inputSchema`(JSON Schema draft-07 부분집합)는 OpenAPI 3.1의 스키마 객체로 그대로 쓸 수 있다. */
function requestSchema(tool: AgentToolSpec): OpenApiObject {
    const { properties, required } = tool.inputSchema;
    return {
        type: 'object',
        properties: Object.fromEntries(
            Object.entries(properties).map(([name, prop]) => [
                name,
                propertySchema(prop),
            ])
        ),
        required: required === undefined ? undefined : [...required],
        additionalProperties: false,
    };
}

// ─── 경로 ───────────────────────────────────────────────────────────────────

const LOCALE_PARAMETER = ref('parameters/SiglensLocale');
const SECURED: YamlValue[] = [{ [BEARER_SCHEME]: [] }];

function dataRateLimitHeaders(): OpenApiObject {
    return RATE_LIMIT_HEADER_REFS;
}

function aiRateLimitHeaders(): OpenApiObject {
    return {
        'X-RateLimit-AI-Limit': ref('headers/AiRateLimitLimit'),
        'X-RateLimit-AI-Remaining': ref('headers/AiRateLimitRemaining'),
        'X-RateLimit-AI-Reset': ref('headers/AiRateLimitReset'),
    };
}

const FRESH_ANALYSIS_STREAM_DESCRIPTION = [
    'Returned when a cached analysis exists (`meta.source: "cache"`) or a new analysis was generated (`meta.source: "fresh"`).',
    '',
    'A new analysis takes 30-250 seconds. After the request passes validation, authentication, rate limits and the model and key checks, the response starts immediately as HTTP 200 and is written in two parts: whitespace keepalive bytes (a newline, sent periodically so proxies do not close the silent connection), then the JSON body. Leading whitespace is valid JSON, so parse the whole body. Because the 200 status is already sent, a failure after that point is a 200 whose body is `{ "error": { ... } }`. Always check for an `error` field, even on 200.',
    '',
    'A streamed response carries `X-RateLimit-AI-*` for the `ai` quota it used. Cache hits are normal JSON responses without those headers.',
].join('\n');

function toolOperation(
    tool: AgentToolSpec,
    reference: ApiToolReference
): OpenApiObject {
    const isFresh = reference.name === FRESH_ANALYSIS_TOOL;
    const group = isFresh ? FRESH_ANALYSIS_ERRORS : TOOL_ERRORS;
    const hasRequired = reference.arguments.some(arg => arg.required);
    const description = isFresh
        ? `${reference.description}\n\n${renderFreshAnalysisNotes().join('\n')}`
        : reference.description;
    const success: OpenApiObject = isFresh
        ? {
              description: FRESH_ANALYSIS_STREAM_DESCRIPTION,
              headers: { ...dataRateLimitHeaders(), ...aiRateLimitHeaders() },
              content: {
                  [JSON_CONTENT]: {
                      schema: {
                          oneOf: [
                              ref('schemas/ToolSuccess'),
                              ref('schemas/ErrorResponse'),
                          ],
                      },
                  },
              },
          }
        : {
              description:
                  'The tool result in `data`. `meta.truncated: true` means the result was cut to its size cap and `data` is `{ "truncated": true, "preview": "..." }`; narrow the request and retry.',
              headers: dataRateLimitHeaders(),
              content: {
                  [JSON_CONTENT]: { schema: ref('schemas/ToolSuccess') },
              },
          };
    return {
        operationId: reference.name,
        tags: ['Tools'],
        summary: `Call ${reference.name}`,
        description,
        parameters: [LOCALE_PARAMETER],
        requestBody: {
            required: hasRequired,
            description: hasRequired
                ? 'Tool arguments as a JSON object.'
                : 'Tool arguments as a JSON object. This tool takes none: send `{}` or an empty body.',
            content: {
                [JSON_CONTENT]: {
                    schema: requestSchema(tool),
                    example: reference.exampleArgs as YamlValue,
                },
            },
        },
        responses: { '200': success, ...errorRefs(group) },
        ...(isFresh ? { 'x-byok': true } : {}),
    };
}

function buildToolPaths(
    tools: readonly AgentToolSpec[],
    baseUrl: string
): OpenApiObject {
    return Object.fromEntries(
        tools.map(tool => {
            const [reference] = buildApiToolReferences({
                baseUrl,
                tools: [tool],
            });
            return [
                `/tools/${tool.name}`,
                { post: toolOperation(tool, reference as ApiToolReference) },
            ];
        })
    );
}

function buildMePath(): OpenApiObject {
    return {
        get: {
            operationId: 'getMe',
            tags: ['Account'],
            summary: 'Show the API key and remaining quota',
            description:
                'The key name and prefix, the account tier, the API default model, the BYOK providers you registered, and your remaining rate limit. The call itself counts against the `data` limit; the remaining quota is read right after it.\n\n`rateLimits` is `null` when the limit store cannot be read.',
            responses: {
                '200': {
                    description: 'The key and account status.',
                    headers: dataRateLimitHeaders(),
                    content: {
                        [JSON_CONTENT]: { schema: ref('schemas/MeResponse') },
                    },
                },
                ...errorRefs(ACCOUNT_ERRORS),
            },
        },
    };
}

function buildToolsPath(): OpenApiObject {
    return {
        get: {
            operationId: 'listTools',
            tags: ['Tools'],
            summary: 'List the tools',
            description: `The tools that can be called and the JSON schema of their arguments, from the same source as this document and SKILL.md. Call a tool with \`POST ${PUBLIC_API_BASE_PATH}/tools/{name}\`; each tool has its own path below. The call counts against the \`data\` limit.`,
            responses: {
                '200': {
                    description: 'The tool list.',
                    headers: dataRateLimitHeaders(),
                    content: {
                        [JSON_CONTENT]: {
                            schema: ref('schemas/ToolListResponse'),
                        },
                    },
                },
                ...errorRefs(ACCOUNT_ERRORS),
            },
        },
    };
}

function publicGet(
    operationId: string,
    summary: string,
    description: string,
    contentType: string,
    schema: OpenApiObject
): OpenApiObject {
    return {
        get: {
            operationId,
            tags: ['Docs'],
            summary,
            description,
            security: [],
            responses: {
                '200': {
                    description: 'The document.',
                    content: { [contentType]: { schema } },
                },
            },
        },
    };
}

function buildDocPaths(): OpenApiObject {
    return {
        [PUBLIC_API_DOC_PATHS.skill]: publicGet(
            'getSkill',
            'Download SKILL.md',
            'The Agent Skill file for Claude Code and Claude.ai Skills, built from the same tool list. No API key is needed.',
            'text/markdown',
            { type: 'string' }
        ),
        [PUBLIC_API_DOC_PATHS.openapiJson]: publicGet(
            'getOpenApiJson',
            'Download this document as JSON',
            'This OpenAPI 3.1 document as JSON. No API key is needed.',
            JSON_CONTENT,
            { type: 'object' }
        ),
        [PUBLIC_API_DOC_PATHS.openapiYaml]: publicGet(
            'getOpenApiYaml',
            'Download this document as YAML',
            'This OpenAPI 3.1 document as YAML. No API key is needed.',
            'application/yaml',
            { type: 'string' }
        ),
    };
}

// ─── components ─────────────────────────────────────────────────────────────

function rateWindowSchema(): OpenApiObject {
    return {
        type: 'object',
        required: ['limit', 'remaining', 'resetAtEpochSeconds'],
        properties: {
            limit: { type: 'integer' },
            remaining: { type: 'integer' },
            resetAtEpochSeconds: {
                type: 'integer',
                description: 'Epoch seconds when the window ends.',
            },
        },
    };
}

function rateBucketSchema(): OpenApiObject {
    return {
        type: 'object',
        required: ['minute', 'day'],
        properties: {
            minute: rateWindowSchema(),
            day: rateWindowSchema(),
        },
    };
}

function buildSchemas(): OpenApiObject {
    return {
        ErrorResponse: {
            type: 'object',
            required: ['error'],
            properties: {
                error: {
                    type: 'object',
                    required: ['code', 'message'],
                    properties: {
                        code: {
                            type: 'string',
                            description: `Machine-readable code. Documented codes: ${[...new Set(API_ERROR_DOCS.map(doc => doc.code))].map(code => `\`${code}\``).join(', ')}. New codes can appear, so treat an unknown code by its HTTP status.`,
                        },
                        message: {
                            type: 'string',
                            description:
                                'Human-readable message, always in English.',
                        },
                        details: {
                            description:
                                'Extra fields that depend on the code, such as `issues`, `provider` or `status`. Absent when there is nothing to add.',
                        },
                    },
                },
            },
        },
        ToolMeta: {
            type: 'object',
            properties: {
                tool: { type: 'string', description: 'The tool name.' },
                truncated: {
                    type: 'boolean',
                    const: true,
                    description:
                        'Present only when the result was cut to its size cap.',
                },
                source: {
                    type: 'string',
                    enum: ['cache', 'fresh'],
                    description:
                        'Analysis tools only: a shared cache hit, or an analysis generated on your own key.',
                },
                model: {
                    type: 'string',
                    description:
                        'Analysis tools only: the model that wrote the analysis.',
                },
            },
        },
        ToolSuccess: {
            type: 'object',
            required: ['data', 'meta'],
            properties: {
                data: {
                    description:
                        'The tool result. Its shape depends on the tool; see the tool description.',
                },
                meta: ref('schemas/ToolMeta'),
            },
        },
        MeResponse: {
            type: 'object',
            required: ['data', 'meta'],
            properties: {
                data: {
                    type: 'object',
                    required: [
                        'key',
                        'tier',
                        'defaultModel',
                        'byokProviders',
                        'rateLimits',
                    ],
                    properties: {
                        key: {
                            type: 'object',
                            required: ['id', 'name', 'prefix'],
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                prefix: {
                                    type: 'string',
                                    description: `The first characters of the key (\`${API_KEY_PREFIX}...\`), safe to show.`,
                                },
                            },
                        },
                        tier: {
                            type: 'string',
                            enum: ['free', 'member', 'pro'],
                        },
                        defaultModel: {
                            type: ['string', 'null'],
                            description:
                                'The API default model set at siglens.io/account, or null when none is set.',
                        },
                        byokProviders: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Providers you registered a key for.',
                        },
                        rateLimits: {
                            type: ['object', 'null'],
                            description:
                                'Remaining quota per bucket and window; null when the limit store cannot be read.',
                            properties: {
                                data: rateBucketSchema(),
                                ai: rateBucketSchema(),
                            },
                        },
                    },
                },
                meta: { type: 'object' },
            },
        },
        ToolListResponse: {
            type: 'object',
            required: ['data', 'meta'],
            properties: {
                data: {
                    type: 'object',
                    required: ['tools'],
                    properties: {
                        tools: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: [
                                    'name',
                                    'description',
                                    'inputSchema',
                                ],
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    inputSchema: {
                                        type: 'object',
                                        description:
                                            'JSON Schema of the arguments.',
                                    },
                                },
                            },
                        },
                    },
                },
                meta: { type: 'object' },
            },
        },
    };
}

function integerHeader(description: string): OpenApiObject {
    return { description, schema: { type: 'integer' } };
}

function buildHeaders(): OpenApiObject {
    return {
        RateLimitLimit: integerHeader(
            `Limit of the \`data\` bucket for the window in effect (${renderLimits(PUBLIC_API_RATE_LIMITS.data)}). Sent on every metered response: success, tool error and 429. Requests rejected before metering (401, 400, 404, 413) do not carry it.`
        ),
        RateLimitRemaining: integerHeader(
            'Requests left in the current `data` window.'
        ),
        RateLimitReset: integerHeader(
            'Epoch seconds when the `data` window ends.'
        ),
        AiRateLimitLimit: integerHeader(
            `Limit of the \`ai\` bucket (${renderLimits(PUBLIC_API_RATE_LIMITS.ai)}). Sent only on a streamed \`run_fresh_analysis\` response, which used that quota.`
        ),
        AiRateLimitRemaining: integerHeader(
            'Generations left in the current `ai` window.'
        ),
        AiRateLimitReset: integerHeader(
            'Epoch seconds when the `ai` window ends.'
        ),
        RetryAfter: integerHeader('Seconds to wait before retrying.'),
    };
}

function buildComponents(): OpenApiObject {
    return {
        securitySchemes: {
            [BEARER_SCHEME]: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: `API key (${API_KEY_PREFIX}...)`,
                description: `An API key created at siglens.io/account, sent as \`Authorization: Bearer ${API_KEY_PREFIX}...\`. Session cookies are never read.`,
            },
        },
        parameters: {
            SiglensLocale: {
                name: LOCALE_HEADER_DOC_NAME,
                in: 'header',
                required: false,
                description: `Language of localized text. Defaults to \`${DEFAULT_LOCALE}\`, the same as siglens.io, so analyses written by the website are shared.`,
                schema: {
                    type: 'string',
                    enum: [...LOCALES],
                    default: DEFAULT_LOCALE,
                },
            },
        },
        headers: buildHeaders(),
        schemas: buildSchemas(),
        responses: buildErrorResponses(),
    };
}

// ─── 문서 ───────────────────────────────────────────────────────────────────

function buildInfoDescription(baseUrl: string): string {
    return [
        'Read SigLens market data and AI analysis over HTTP: the same tools the ai.siglens.io agent uses.',
        '',
        `- Base URL: \`${baseUrl}${PUBLIC_API_BASE_PATH}\`.`,
        `- Authentication: \`Authorization: Bearer ${API_KEY_PREFIX}...\`. Create a key at siglens.io/account.`,
        '- AI analysis uses your own LLM key (BYOK). SigLens never spends its own key on API calls, and a cached analysis costs nothing.',
        `- Rate limits are per account, shared by all your keys: ${renderLimits(PUBLIC_API_RATE_LIMITS.data)} for tools; generating a new analysis has its own limit of ${renderLimits(PUBLIC_API_RATE_LIMITS.ai)}.`,
        `- Responses are \`{ "data": ..., "meta": ... }\` on success and \`{ "error": { "code", "message" } }\` on failure. A request body is limited to ${PUBLIC_API_MAX_BODY_CHARS.toLocaleString('en-US')} characters.`,
        `- Send \`${LOCALE_HEADER_DOC_NAME}: ${LOCALES.join('|')}\` to choose the language of localized text.`,
        '- Tool descriptions are written for an in-app assistant; ignore references to tools that have no path in this document.',
        '- Not investment advice. Quote delays and data freshness are reported in each result.',
    ].join('\n');
}

/**
 * 노출 도구 스펙에서 OpenAPI 3.1 문서를 만든다. 도구마다 경로 하나(`/tools/{name}`을 이름별로 펼친 것)이고
 * `inputSchema`가 요청 본문이다 — SKILL.md·`GET /tools`와 같은 `tools` 입력에서 나오므로 새 도구는 문서에도
 * 자동으로 나타난다. 한도·상수는 `shared/config/publicApi`에서 읽고 문구에 숫자를 따로 적지 않는다.
 *
 * 순수 함수다(네트워크·환경 변수 없음). 이 문서는 인증 없이 공개되므로 비밀이 들어갈 자리가 없다.
 */
export function buildOpenApiDocument({
    baseUrl,
    tools,
}: BuildOpenApiDocumentInput): OpenApiDocument {
    return {
        openapi: OPENAPI_VERSION,
        info: {
            title: 'SigLens API',
            version: OPENAPI_API_VERSION,
            summary:
                'Stock, crypto and macro data and AI analysis, with AI on your own key.',
            description: buildInfoDescription(baseUrl),
        },
        servers: [
            {
                url: `${baseUrl}${PUBLIC_API_BASE_PATH}`,
                description: 'SigLens',
            },
        ],
        externalDocs: {
            description: 'Developer guide',
            url: `${baseUrl}/developers`,
        },
        security: SECURED,
        tags: [
            {
                name: 'Account',
                description: 'Your API key and remaining quota.',
            },
            {
                name: 'Tools',
                description:
                    'Market data and analysis tools. One path per tool.',
            },
            {
                name: 'Docs',
                description: 'This document and SKILL.md. No API key needed.',
            },
        ],
        paths: {
            '/me': buildMePath(),
            '/tools': buildToolsPath(),
            ...buildToolPaths(tools, baseUrl),
            ...buildDocPaths(),
        },
        components: buildComponents(),
    };
}
