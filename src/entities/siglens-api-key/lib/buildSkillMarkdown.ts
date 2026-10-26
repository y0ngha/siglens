import type { AgentToolSpec, JsonSchemaProperty } from '@y0ngha/siglens-core';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import {
    API_KEY_ENV_NAME,
    LOCALE_HEADER_DOC_NAME,
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_CHART_DATA,
    PUBLIC_API_CHART_DATA_MEASURED_SIZES,
    PUBLIC_API_RATE_LIMITS,
    type PublicApiRateLimit,
} from '@/shared/config/publicApi';
import { DEFAULT_LOCALE, LOCALES } from '@/shared/i18n/locales';

export interface BuildSkillMarkdownInput {
    /** 사이트 origin(끝 슬래시 없음). 예: `https://siglens.io` */
    baseUrl: string;
    /** 실제로 노출하는 도구 스펙만. 여기 없는 도구는 문서에도 없다. */
    tools: readonly AgentToolSpec[];
}

/** 이 도구가 노출되면 분석 생성이 사용자 BYOK 키를 쓴다는 안내를 덧붙인다. */
export const FRESH_ANALYSIS_TOOL = 'run_fresh_analysis';

const SKILL_DESCRIPTION =
    "Query SigLens stock analysis (US/KR equities, crypto): ticker search, quotes, bars with indicators (one call returns bars plus any of the technical indicators as time-aligned series), AI technical analysis, news, options, fundamentals, congress trades, macro. Use when the user asks about a stock's chart, signals or analysis.";

/** 인자 타입의 사람용 표기(`"1Day" | "1Hour"`, `integer (10..60)`). `/developers`의 인자 표도 같은 표기를 쓴다. */
export function typeLabel(prop: JsonSchemaProperty): string {
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
            prop.description === undefined ? '' : `: ${prop.description}`;
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

export function renderLimits(limits: PublicApiRateLimit): string {
    return `${limits.perMinute}/minute, ${limits.perDay.toLocaleString('en-US')}/day`;
}

/**
 * `run_fresh_analysis`가 노출될 때만 붙는 BYOK 안내(OpenAPI 문서의 같은 도구 설명도 이 줄들을 쓴다). 오류 코드는 `runByokFreshAnalysis`가 내는 값과
 * 같아야 한다(문서가 실제 응답을 앞서가지 않도록 그쪽 테스트가 코드를 고정한다).
 */
export function renderFreshAnalysisNotes(): string[] {
    return [
        '- `run_fresh_analysis` first looks for a shared cached analysis: a hit is returned at no cost (`meta.source: "cache"`, no LLM call, no `ai` quota) with a normal JSON response. Only when none exists does it generate one, with your own LLM key registered at siglens.io/account (BYOK). SigLens never spends its own LLM key on API calls.',
        "- Every model in the `model` argument list can generate a new analysis, free and member models included, but only with your own registered key for that model's provider. SigLens's own LLM key is never used (the SigLens website generates the lower models with its own key; the API does not).",
        '- Pick the model with `model`, or set an API default model at siglens.io/account (`GET /me` shows it as `defaultModel`).',
        `- Generation attempts (a cache miss that calls your LLM) have their own per-account limit: ${renderLimits(PUBLIC_API_RATE_LIMITS.ai)}. Cached hits only use the regular limit above.`,
        `- Generating usually takes about a minute and never longer than the ${FRESH_ANALYSIS_DEADLINE_SECONDS}-second tool deadline (then \`tool_timeout\`). Once everything is validated and generation starts, the response is HTTP 200 \`application/json\` that is written in two parts: whitespace keepalive bytes (a newline, sent periodically so proxies do not cut the silent connection), then the JSON body. Leading whitespace is valid JSON, so just parse the whole body. Because the status is already sent, a failure after that point also arrives as HTTP 200: parse the body, and an \`error\` field means failure even on 200. The streamed response also carries \`X-RateLimit-AI-Limit\`, \`X-RateLimit-AI-Remaining\` and \`X-RateLimit-AI-Reset\` for the \`ai\` quota it just used (cache hits do not touch that quota, so they have no such headers). Everything found before generation (auth, rate limits, bad arguments, model, missing key, cache hits) uses normal status codes and a normal body. Closing the connection does not cancel the generation: it still finishes, is charged to your key, and fills the shared cache, so calling again later returns it as a cache hit.`,
        '- `run_fresh_analysis` errors with a normal status: 400 `model_required` (no `model` and no default), 400 `invalid_model`, 400 `byok_key_required` (`error.details.provider` is the provider whose key you must register), 429 `rate_limited`, 503 `busy`. Errors inside a streamed (200) body use the same shape: `analysis_failed` (`error.details.code` says why, e.g. `no_news`), `provider_error` (`error.details`: `provider`, `status`; your key was rejected or the provider is failing, so fix the key/quota or retry later), `tool_timeout`, `tool_failed`.',
    ];
}

/**
 * `get_chart_data`가 노출될 때만 붙는 안내(OpenAPI 문서의 같은 도구 설명도 이 줄들을 쓴다). 크기 숫자는 합성
 * 일봉 실측이고 응답마다 조금 다르다.
 */
export function renderChartDataNotes(): string[] {
    const { tool, maxResponseChars } = PUBLIC_API_CHART_DATA;
    const { shortBars, longBars, equity, lowPricedCrypto } =
        PUBLIC_API_CHART_DATA_MEASURED_SIZES;
    const chars = (n: number): string => n.toLocaleString('en-US');
    return [
        `- \`${tool}\` is not size-capped into a preview like the other tools. Asking for every indicator is large: about ${chars(equity.short)} characters at ${shortBars} bars and about ${chars(equity.long)} at ${longBars} bars (up to about ${chars(lowPricedCrypto.short)} and ${chars(lowPricedCrypto.long)} for very low-priced crypto, whose numbers are longer; measured on daily bars). Pass \`indicators\` with just the names you need and a small \`bars\` to keep it light. As a safety net a response over ${chars(maxResponseChars)} characters drops its oldest bars instead (\`data.meta.barsLimitedBySize: true\`; \`data.bars\` is the count returned).`,
        `- \`${tool}\` errors: 400 \`invalid_args\` (an unknown indicator name lists the allowed names in \`error.details.issues\`), 403 \`timeframe_not_allowed\` (the timeframe is not open to your account tier, the same rule as the website chart), 404 \`bars_not_found\`.`,
    ];
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
    const hasChartData = tools.some(t => t.name === PUBLIC_API_CHART_DATA.tool);
    const notes = [
        '- Tool descriptions are written for an in-app assistant; ignore references to tools that are not listed here.',
        '- Results are size-capped per tool. When a result is cut, the response carries `meta.truncated: true` and `data` is `{ "truncated": true, "preview": "..." }`; narrow the request (fewer bars, a shorter list) and retry.',
        '- `get_news` returns only news SigLens has already stored; this API never triggers a fresh ingest or a server-side analysis.',
        '- Analyses returned by `get_cached_analysis` were generated on siglens.io; reading them costs nothing and never calls an LLM.',
        ...(hasFreshAnalysis ? renderFreshAnalysisNotes() : []),
        ...(hasChartData ? renderChartDataNotes() : []),
        `- Rate limits are per account (all your keys share them): ${renderLimits(PUBLIC_API_RATE_LIMITS.data)}. Every call to \`/me\`, \`/tools\` and a tool counts. Over the limit you get HTTP 429 with \`Retry-After\`. Every metered response (success, tool error and 429) carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (epoch seconds); requests rejected before metering (401, 400, 404, 413) do not.`,
        '- Responses are `{ "data": ..., "meta": { "tool": "<name>" } }` on success (`run_fresh_analysis` adds `meta.source` and `meta.model`) and `{ "error": { "code": "...", "message": "..." } }` on failure (401 `invalid_api_key`, 400 `invalid_args`, 429 `rate_limited`, 503 `rate_limiter_unavailable`).',
        `- Send \`${LOCALE_HEADER_DOC_NAME}: ${LOCALES.join('|')}\` to choose the language of localized text (default \`${DEFAULT_LOCALE}\`, the same as siglens.io, so cached analyses written by the website are shared).`,
        '- Not investment advice. Quote delays and data freshness are reported in each result; pass them on to the user.',
    ];
    return [
        '---',
        'name: siglens',
        `description: ${SKILL_DESCRIPTION}`,
        '---',
        '',
        '# SigLens',
        '',
        `Auth: create an API key at siglens.io/account, export it as \`${API_KEY_ENV_NAME}\`, and send \`Authorization: Bearer $${API_KEY_ENV_NAME}\` with every request.`,
        '',
        'Call a tool with:',
        '',
        '```bash',
        `curl -s -X POST ${endpoint}/tools/<name> \\`,
        `  -H "Authorization: Bearer $${API_KEY_ENV_NAME}" \\`,
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
