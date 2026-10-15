import type { AgentToolSpec, JsonSchemaProperty } from '@y0ngha/siglens-core';
import { API_GENERATABLE_MODELS } from '@/entities/siglens-api-key/lib/apiModels';
import {
    FRESH_ANALYSIS_TOOL,
    typeLabel,
} from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import {
    API_KEY_ENV_NAME,
    PUBLIC_API_BASE_PATH,
} from '@/shared/config/publicApi';

export interface ApiToolArgument {
    readonly name: string;
    /** `"1Day" | "1Hour"`, `integer (10..60)` 같은 사람용 표기. */
    readonly type: string;
    readonly required: boolean;
    readonly description: string;
    /** 열거형 인자의 허용값 전체. 화면이 긴 목록을 접을 때 쓴다. */
    readonly enumValues?: readonly string[];
}

/** 도구 하나의 문서용 표현. OpenAPI 문서의 경로와 `/developers`의 도구 레퍼런스가 같이 쓴다. */
export interface ApiToolReference {
    readonly name: string;
    readonly description: string;
    /** 기본 경로(`/api/v1`) 아래의 경로: `/tools/get_quote`. */
    readonly path: string;
    /** 호출 URL 전체: `https://siglens.io/api/v1/tools/get_quote`. */
    readonly url: string;
    readonly arguments: readonly ApiToolArgument[];
    /** 필수 인자만으로 만든 예시 본문. */
    readonly exampleArgs: Readonly<Record<string, unknown>>;
    readonly curl: string;
    /** 새 분석 생성이 사용자 BYOK 키를 쓰는 도구인가. */
    readonly byok: boolean;
}

export interface BuildApiToolReferencesInput {
    /** 사이트 origin(끝 슬래시 없음). */
    baseUrl: string;
    tools: readonly AgentToolSpec[];
}

/**
 * 스펙만으로는 뜻 있는 값을 못 만드는 도구의 예시 보정. 값이 스키마 열거값과 어긋나면 호출이 400이라
 * `exampleArgumentsFor`가 필수 인자 이름만 보고 만든 값 위에 덮어쓴다.
 */
const EXAMPLE_OVERRIDES: Readonly<Record<string, Record<string, unknown>>> = {
    search_ticker: { query: 'apple' },
    get_guide: { query: 'MACD' },
};

function exampleValue(name: string, prop: JsonSchemaProperty): unknown {
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
): Record<string, unknown> {
    const required = new Set(tool.inputSchema.required ?? []);
    const generated = Object.fromEntries(
        Object.entries(tool.inputSchema.properties)
            .filter(([name]) => required.has(name))
            .map(([name, prop]) => [name, exampleValue(name, prop)])
    );
    const args: Record<string, unknown> = {
        ...generated,
        ...EXAMPLE_OVERRIDES[tool.name],
    };
    // `run_fresh_analysis`: `model`이 없으면 계정에 기본 모델이 있어야 한다. 예시는 그 없이도 돌아가게
    // 생성 가능한 첫 모델을 싣는다(스펙에 `model` 인자가 있을 때만).
    const [firstModel] = API_GENERATABLE_MODELS;
    if (
        tool.name === FRESH_ANALYSIS_TOOL &&
        'model' in tool.inputSchema.properties &&
        firstModel !== undefined
    )
        args.model = firstModel;
    return args;
}

export function buildCurlExample(
    url: string,
    args: Readonly<Record<string, unknown>>
): string {
    return [
        `curl -s -X POST ${url} \\`,
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
        ...(prop.enum === undefined ? {} : { enumValues: prop.enum }),
    }));
}

export function buildApiToolReferences({
    baseUrl,
    tools,
}: BuildApiToolReferencesInput): ApiToolReference[] {
    return tools.map(tool => {
        const path = `/tools/${tool.name}`;
        const url = `${baseUrl}${PUBLIC_API_BASE_PATH}${path}`;
        const exampleArgs = exampleArgumentsFor(tool);
        return {
            name: tool.name,
            description: tool.description,
            path,
            url,
            arguments: argumentsOf(tool),
            exampleArgs,
            curl: buildCurlExample(url, exampleArgs),
            byok: tool.name === FRESH_ANALYSIS_TOOL,
        };
    });
}
