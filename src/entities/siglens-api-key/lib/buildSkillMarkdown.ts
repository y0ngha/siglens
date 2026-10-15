import type { AgentToolSpec, JsonSchemaProperty } from '@y0ngha/siglens-core';
import {
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_RATE_LIMITS,
    type PublicApiRateLimit,
} from '@/shared/config/publicApi';

export interface BuildSkillMarkdownInput {
    /** 사이트 origin(끝 슬래시 없음). 예: `https://siglens.io` */
    baseUrl: string;
    /** 실제로 노출하는 도구 스펙만. 여기 없는 도구는 문서에도 없다. */
    tools: readonly AgentToolSpec[];
}

/** 이 도구가 노출되면 분석 생성이 사용자 BYOK 키를 쓴다는 안내를 덧붙인다. */
const FRESH_ANALYSIS_TOOL = 'run_fresh_analysis';

const SKILL_DESCRIPTION =
    "Query SigLens stock analysis (US/KR equities, crypto) — ticker search, quotes, bars with indicators, AI technical analysis, news, options, fundamentals, congress trades, macro. Use when the user asks about a stock's chart, signals or analysis.";

function typeLabel(prop: JsonSchemaProperty): string {
    if (prop.enum !== undefined)
        return prop.enum.map(value => `"${value}"`).join(' | ');
    if (prop.type === 'array')
        return `array of ${prop.items === undefined ? 'values' : typeLabel(prop.items)}`;
    const range =
        prop.minimum !== undefined || prop.maximum !== undefined
            ? ` (${prop.minimum ?? ''}..${prop.maximum ?? ''})`
            : '';
    return `${prop.type}${range}`;
}

function renderArguments(tool: AgentToolSpec): string {
    const entries = Object.entries(tool.inputSchema.properties);
    if (entries.length === 0) return 'Arguments: none (send `{}`).';
    const required = new Set(tool.inputSchema.required ?? []);
    const lines = entries.map(([name, prop]) => {
        const flag = required.has(name) ? 'required' : 'optional';
        const description =
            prop.description === undefined ? '' : ` — ${prop.description}`;
        return `- \`${name}\` (${typeLabel(prop)}, ${flag})${description}`;
    });
    return ['Arguments:', ...lines].join('\n');
}

function renderTool(tool: AgentToolSpec): string {
    return [
        `### \`${tool.name}\``,
        '',
        tool.description,
        '',
        renderArguments(tool),
    ].join('\n');
}

function renderLimits(limits: PublicApiRateLimit): string {
    return `${limits.perMinute}/minute, ${limits.perDay.toLocaleString('en-US')}/day`;
}

/**
 * 노출 도구 스펙에서 SKILL.md를 만든다. 도구 목록·설명·인자는 core의 `AGENT_TOOL_SPECS`를
 * 그대로 옮기고 이 파일은 말을 덧붙이지 않는다 — 스펙이 바뀌면 문서도 따라온다.
 */
export function buildSkillMarkdown({
    baseUrl,
    tools,
}: BuildSkillMarkdownInput): string {
    const endpoint = `${baseUrl}${PUBLIC_API_BASE_PATH}`;
    const hasFreshAnalysis = tools.some(t => t.name === FRESH_ANALYSIS_TOOL);
    const notes = [
        '- Tool descriptions are written for an in-app assistant; ignore references to tools that are not listed here.',
        '- Results are size-capped per tool. When a result is cut, the response carries `meta.truncated: true` and `data` is `{ "truncated": true, "preview": "..." }`; narrow the request (fewer bars, a shorter list) and retry.',
        '- `get_news` returns only news SigLens has already stored; this API never triggers a fresh ingest or a server-side analysis.',
        '- Analyses returned by `get_cached_analysis` were generated on siglens.io; reading them costs nothing and never calls an LLM.',
        ...(hasFreshAnalysis
            ? [
                  '- Generating a new analysis uses your own LLM key registered at siglens.io/account (BYOK). SigLens never spends its own key on API calls.',
              ]
            : []),
        `- Rate limits are per account (all your keys share them): ${renderLimits(PUBLIC_API_RATE_LIMITS.data)}. Every call to \`/me\`, \`/tools\` and a tool counts. Over the limit you get HTTP 429 with \`Retry-After\`. Every metered response (success, tool error and 429) carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (epoch seconds); requests rejected before metering (401, 400, 404, 413) do not.`,
        '- Responses are `{ "data": ..., "meta": { "tool": "<name>" } }` on success and `{ "error": { "code": "...", "message": "..." } }` on failure (401 `invalid_api_key`, 400 `invalid_args`, 429 `rate_limited`, 503 `rate_limiter_unavailable`).',
        '- Send `X-Siglens-Locale: ko|en|ja|zh` to choose the language of localized text (default `en`).',
        '- Not investment advice. Quote delays and data freshness are reported in each result — pass them on to the user.',
    ];
    return [
        '---',
        'name: siglens',
        `description: ${SKILL_DESCRIPTION}`,
        '---',
        '',
        '# SigLens',
        '',
        'Auth: create an API key at siglens.io/account, export it as `SIGLENS_API_KEY`, and send `Authorization: Bearer $SIGLENS_API_KEY` with every request.',
        '',
        'Call a tool with:',
        '',
        '```bash',
        `curl -s -X POST ${endpoint}/tools/<name> \\`,
        '  -H "Authorization: Bearer $SIGLENS_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        "  -d '<json args>'",
        '```',
        '',
        `The tool list as JSON is at \`GET ${endpoint}/tools\`; your key's status and remaining quota are at \`GET ${endpoint}/me\`.`,
        '',
        '## Tools',
        '',
        tools.map(renderTool).join('\n\n'),
        '',
        '## Notes',
        '',
        notes.join('\n'),
        '',
    ].join('\n');
}
