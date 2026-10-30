import type { AgentToolSpec, JsonSchemaProperty } from '@y0ngha/siglens-core';
import { API_KNOWN_MODELS } from '@/entities/siglens-api-key/lib/apiModels';
import type {
    ApiToolArgument,
    ApiToolReference,
} from '@/entities/siglens-api-key/model';
import {
    FRESH_ANALYSIS_TOOL,
    typeLabel,
} from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import {
    API_KEY_ENV_NAME,
    PUBLIC_API_BASE_PATH,
} from '@/shared/config/publicApi';
import type { YamlValue } from '@/shared/lib/toYaml';

export interface BuildApiToolReferencesInput {
    /** 사이트 origin(끝 슬래시 없음). */
    baseUrl: string;
    tools: readonly AgentToolSpec[];
}

/**
 * 스펙만으로는 뜻 있는 값을 못 만드는 도구의 예시 보정. 값이 스키마 열거값과 어긋나면 호출이 400이라
 * `exampleArgumentsFor`가 필수 인자 이름만 보고 만든 값 위에 덮어쓴다.
 */
const EXAMPLE_OVERRIDES: Readonly<Record<string, Record<string, YamlValue>>> = {
    search_ticker: { query: 'apple' },
    get_guide: { query: 'MACD' },
    get_chart_data: {
        symbol: 'AAPL',
        timeframe: '1Day',
        indicators: ['rsi', 'macd', 'ma'],
        bars: 50,
    },
};

function exampleValue(name: string, prop: JsonSchemaProperty): YamlValue {
    if (prop.enum !== undefined)
        return prop.enum.includes('1Day') ? '1Day' : prop.enum[0];
    switch (prop.type) {
        case 'string':
            return name.toLowerCase().includes('symbol') ? 'AAPL' : 'string';
        case 'array':
            return [
                prop.items === undefined
                    ? 'AAPL'
                    : exampleValue(name, prop.items),
            ];
        case 'boolean':
            return true;
        case 'integer':
        case 'number':
            return prop.minimum ?? 1;
    }
}

/** 필수 인자만으로 만든 호출 본문. 필수 인자가 없으면 `{}`다. */
export function exampleArgumentsFor(
    tool: AgentToolSpec
): Record<string, YamlValue> {
    const required = new Set(tool.inputSchema.required ?? []);
    const generated = Object.fromEntries(
        Object.entries(tool.inputSchema.properties)
            .filter(([name]) => required.has(name))
            .map(([name, prop]) => [name, exampleValue(name, prop)])
    );
    const args: Record<string, YamlValue> = {
        ...generated,
        ...EXAMPLE_OVERRIDES[tool.name],
    };
    // `run_fresh_analysis`: `model`이 없으면 계정에 기본 모델이 있어야 한다. 예시는 그 없이도 돌아가게
    // 로스터의 첫 모델을 싣는다(스펙에 `model` 인자가 있을 때만).
    const [firstModel] = API_KNOWN_MODELS;
    if (
        tool.name === FRESH_ANALYSIS_TOOL &&
        'model' in tool.inputSchema.properties &&
        firstModel !== undefined
    )
        args.model = firstModel;
    return args;
}

/** `buildCurlExample` 옵션. */
export interface CurlExampleOptions {
    /** 오래 걸리는 호출(새 분석 생성)용 `--max-time`. 도구 마감보다 짧으면 클라이언트가 먼저 끊는다. */
    readonly maxTimeSeconds?: number;
}

/** 도구 호출 curl 예시. API 키는 환경 변수 이름으로만 적어 원문이 문서에 들어가지 않는다. */
export function buildCurlExample(
    url: string,
    args: Readonly<Record<string, YamlValue>>,
    { maxTimeSeconds }: CurlExampleOptions = {}
): string {
    const maxTime =
        maxTimeSeconds === undefined ? '' : ` --max-time ${maxTimeSeconds}`;
    return [
        `curl -s${maxTime} -X POST ${url} \\`,
        `  -H "Authorization: Bearer $${API_KEY_ENV_NAME}" \\`,
        '  -H "Content-Type: application/json" \\',
        `  -d '${JSON.stringify(args)}'`,
    ].join('\n');
}

function argumentsOf(tool: AgentToolSpec): ApiToolArgument[] {
    const required = new Set(tool.inputSchema.required ?? []);
    return Object.entries(tool.inputSchema.properties).map(([name, prop]) => ({
        name,
        type: typeLabel(prop),
        required: required.has(name),
        description: prop.description ?? '',
        // 열거형 배열(`indicators`)은 원소의 허용값을 접는 목록에 쓴다 — 타입 칸이 36개 이름으로 터지지 않게.
        ...(prop.enum === undefined && prop.items?.enum === undefined
            ? {}
            : { enumValues: prop.enum ?? prop.items?.enum }),
        ...(prop.enum === undefined && prop.items?.enum !== undefined
            ? { array: true as const }
            : {}),
    }));
}

/** 도구 하나의 문서 표현. OpenAPI 경로 빌더가 도구마다 부르고, `buildApiToolReferences`가 목록으로 묶는다. */
export function buildApiToolReference({
    baseUrl,
    tool,
}: {
    readonly baseUrl: string;
    readonly tool: AgentToolSpec;
}): ApiToolReference {
    const path = `/tools/${tool.name}`;
    const url = `${baseUrl}${PUBLIC_API_BASE_PATH}${path}`;
    const exampleArgs = exampleArgumentsFor(tool);
    const byok = tool.name === FRESH_ANALYSIS_TOOL;
    return {
        name: tool.name,
        description: tool.description,
        path,
        url,
        arguments: argumentsOf(tool),
        exampleArgs,
        curl: buildCurlExample(
            url,
            exampleArgs,
            byok ? { maxTimeSeconds: FRESH_ANALYSIS_DEADLINE_SECONDS } : {}
        ),
        byok,
    };
}

/** 노출 도구 전체의 레퍼런스(`/developers` 화면용). 입력 순서를 유지한다. */
export function buildApiToolReferences({
    baseUrl,
    tools,
}: BuildApiToolReferencesInput): ApiToolReference[] {
    return tools.map(tool => buildApiToolReference({ baseUrl, tool }));
}
