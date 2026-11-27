import {
    AGENT_THEMES,
    AGENT_THEME_IDS,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';

/**
 * `get_theme_snapshot` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_THEME_SNAPSHOT_SPEC: AgentToolDefinition = {
    name: 'get_theme_snapshot',
    description: `How a SIGLENS-curated theme basket is trading. Themes: ${AGENT_THEMES.map(theme => `${theme.id} (${theme.nameKo})`).join(', ')}. Returns {asOf, theme {id, nameKo, nameEn, market}, members [{symbol, name, lastClose, lastDate, changePct {'1d', '5d', '20d'}, fromHigh52wPct}] (best 1-day change first), summary per window '1d', '5d' and '20d' {members, avgPct (equal-weight average), medianPct, up, down, flat, best {symbol, pct}, worst {symbol, pct}}, missing (basket symbols whose prices could not be loaded)}. Windows count completed daily sessions: '20d' is about a month, never call it exactly one month; fromHigh52wPct is the distance from the highest close of the last 252 sessions (null with less history). Every figure is precomputed: quote it, do not recompute it. The basket is SIGLENS's own pick of representative pure plays, not an official index: say once that the figures are for SIGLENS's basket of N names and name them when asked. Describe the mood from breadth (how many rose and fell) and the average together, and name the best and worst. For why a theme moved, add get_news for its leading names; never infer a reason from prices alone. When missing is not empty say those names could not be loaded. available false with reason provider_failed means no member could be loaded: say so. Use for theme mood, rallies and sell-offs (양자 테마, 양자컴퓨터 관련주, 네오클라우드, AI 데이터센터, AI 반도체, 원전·SMR, 우주항공, 코인 관련주, 전기차, 국내 반도체·2차전지·방산·조선 분위기, 매도세, 급등). A theme that is not on the list (for example robots, biotech or games) has no basket: say so and answer from the market overview or the news. Never call this tool with a neighbouring theme as a stand-in (robots are not ev) and never describe another basket as the asked theme's mood. Not for a single stock (use the stock tools) or a GICS sector (get_market_overview).`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            theme: {
                type: 'string',
                enum: [...AGENT_THEME_IDS],
                description: 'Theme id from the list',
            },
        },
        required: ['theme'],
        additionalProperties: false,
    },
};
