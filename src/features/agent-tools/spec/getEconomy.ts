import { type AgentToolDefinition } from '@y0ngha/siglens-core';

/**
 * `get_economy` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_ECONOMY_SPEC: AgentToolDefinition = {
    name: 'get_economy',
    description:
        "Macro data for one economy: the United States (default) or South Korea (`country: 'kr'`). " +
        'US: macro indicators (policy rate, CPI, employment, GDP) with the latest-vs-previous change already computed, Treasury yields with their own as-of date (`treasury.date`; cite that date, it can differ from the macro snapshot) including `spread2s10s` (2s10s spread, precomputed — quote it as given, do not recompute it), and the latest SIGLENS macro briefing if available. ' +
        'South Korea: `indicators` are Korean series rebuilt from their release history (Bank of Korea base rate, CPI, PPI, GDP growth, industrial production, exports, Korean government bond (KTB) auction yields, unemployment and similar), each with `latest` ({date, value}: the latest release and its date) and `change` from the previous release; KTB yields appear only as those auction-yield indicators — there is no `treasury` curve, no 2s10s spread and no macro briefing for Korea, so never fill those in from US data. ' +
        "Both: `calendar` is that economy's calendar and carries `coverage` ({from, to}: the dates it spans), `events` and `omitted` (per-impact count of events left out): central-bank rate decisions (FOMC, Bank of Korea) take the first slots, then High, Medium and Low events fill the rest, nearest first — so a date inside `coverage` with no listed row may still have omitted lower-impact releases; say so rather than that nothing is scheduled. Without `from`/`to` it covers the upcoming weeks. For a date outside `coverage` (a later rate meeting, last month's CPI release), call again with `from` and `to` and the same `country`; that call returns only the calendar. Events more than about five months out are only the major ones, and an empty far range means not scheduled yet. Use for rates, inflation, macro calendar or \"what's coming up this week\" questions.",
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            country: {
                type: 'string',
                enum: ['us', 'kr'],
                description:
                    "Which economy: 'us' (default) or 'kr' for South Korea (Bank of Korea, Korean indicators and calendar)",
            },
            from: {
                type: 'string',
                description:
                    'Start date YYYY-MM-DD (inclusive). Give with `to` to look up a specific period.',
            },
            to: {
                type: 'string',
                description:
                    'End date YYYY-MM-DD (inclusive), at most 88 days after `from`; split a longer period into several calls.',
            },
        },
        additionalProperties: false,
    },
};
