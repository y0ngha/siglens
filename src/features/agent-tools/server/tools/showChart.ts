import 'server-only';
import {
    AGENT_CHART_KINDS,
    AGENT_CHART_PERIODS,
    AGENT_COMPARE_SYMBOLS_MAX,
    AGENT_COMPARE_SYMBOLS_MIN,
    type AgentChartKind,
} from '@y0ngha/siglens-core';
import { isChatVisualBlock } from '@/entities/chat-conversation/lib/chartBlock';
import { CHAT_VISUAL_BLOCK_MAX_BYTES } from '@/entities/chat-conversation/types';
import type {
    ChatCompareChartPeriod,
    ChatVisualBlock,
} from '@/entities/chat-conversation/types';
import { resolveAssetInfoOrNull } from '@/entities/ticker/server/resolveAssetInfo';
import {
    isRefusal,
    noData,
    type VisualBuildEnv,
    type VisualOutcome,
} from '@/features/agent-tools/lib/visualBlocks/types';
import type { ToolExecutor } from '@/features/agent-tools/model';
import {
    buildCompareBlock,
    COMPARE_DEFAULT_PERIOD,
} from '@/features/agent-tools/server/visualBlocks/compare';
import { buildDividendsBlock } from '@/features/agent-tools/server/visualBlocks/dividends';
import { buildFinancialsBlock } from '@/features/agent-tools/server/visualBlocks/financials';
import { buildFlowsBlock } from '@/features/agent-tools/server/visualBlocks/flows';
import { buildHeatmapBlock } from '@/features/agent-tools/server/visualBlocks/heatmap';
import { buildOptionsBlock } from '@/features/agent-tools/server/visualBlocks/options';
import { buildPortfolioBlock } from '@/features/agent-tools/server/visualBlocks/portfolio';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { isGuestSubject } from '@/shared/lib/guestSubject';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { withTimeout } from '@/shared/lib/withTimeout';

/**
 * 블록 하나를 기다리는 상한. 블록은 도구 결과이기도 해서 core의 도구 시간 상한(`cached` 30초) 안에서 끝나야 하고,
 * 캔들 차트 블록(`CHART_BLOCK_TIMEOUT_MS`)과 같은 8초로 맞춘다 — 넘으면 그림 없이 `no_data`다.
 */
export const SHOW_CHART_TIMEOUT_MS = 8_000;

/**
 * 제목용 회사 이름 조회의 상한. 이름은 장식이라 블록 만들기 예산({@link SHOW_CHART_TIMEOUT_MS})을 다 쓴 뒤에 또
 * 길게 기다리지 않는다 — 넘으면 이름 없이 심볼로 그린다.
 */
export const SHOW_CHART_NAME_TIMEOUT_MS = 2_000;

const SYMBOL_KINDS: ReadonlySet<AgentChartKind> = new Set([
    'financials',
    'options',
    'flows',
    'dividends',
]);

const EXPIRY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isChartKind = (value: unknown): value is AgentChartKind =>
    AGENT_CHART_KINDS.some(kind => kind === value);

const isPeriod = (value: unknown): value is ChatCompareChartPeriod =>
    AGENT_CHART_PERIODS.some(period => period === value);

const invalid = (reason: string): VisualOutcome => ({
    error: 'invalid_args',
    reason,
});

/** 비교 종목 목록 — 대문자·중복 제거 후 2~5개여야 한다. */
function compareSymbols(args: Record<string, unknown>): string[] | null {
    const list = Array.isArray(args.symbols) ? args.symbols : [];
    const symbols = [
        ...new Set(
            list
                .filter((s): s is string => typeof s === 'string')
                .map(s => s.trim().toUpperCase())
                .filter(s => s !== '')
        ),
    ];
    return symbols.length >= AGENT_COMPARE_SYMBOLS_MIN &&
        symbols.length <= AGENT_COMPARE_SYMBOLS_MAX
        ? symbols
        : null;
}

function buildFor(
    kind: AgentChartKind,
    args: Record<string, unknown>,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    if (kind === 'compare') {
        const symbols = compareSymbols(args);
        if (symbols === null)
            return Promise.resolve(
                invalid(
                    `compare needs ${AGENT_COMPARE_SYMBOLS_MIN}-${AGENT_COMPARE_SYMBOLS_MAX} distinct symbols`
                )
            );
        return buildCompareBlock(
            symbols,
            isPeriod(args.period) ? args.period : COMPARE_DEFAULT_PERIOD,
            env
        );
    }
    if (kind === 'portfolio') return buildPortfolioBlock(env);
    if (kind === 'heatmap')
        return buildHeatmapBlock(
            args.market === 'kr' ? 'kr' : 'us',
            typeof args.theme === 'string' ? args.theme : null,
            env
        );
    const symbol =
        typeof args.symbol === 'string' ? args.symbol.trim().toUpperCase() : '';
    if (SYMBOL_KINDS.has(kind) && symbol === '')
        return Promise.resolve(invalid(`${kind} needs a symbol`));
    if (kind === 'financials') return buildFinancialsBlock(symbol, env);
    if (kind === 'options')
        return buildOptionsBlock(
            symbol,
            typeof args.expiry === 'string' && EXPIRY_PATTERN.test(args.expiry)
                ? args.expiry
                : null
        );
    if (kind === 'flows') return buildFlowsBlock(symbol, env);
    return buildDividendsBlock(symbol, env);
}

/**
 * 한 종목 블록의 제목에 쓸 회사 이름을 붙인다(답변 언어가 기본 로케일이면 한글명 우선). 자산 정보를 못 읽거나 {@link SHOW_CHART_NAME_TIMEOUT_MS}를 넘기면 이름 없이
 * 심볼로 그린다 — 그림 자체는 이름이 없어도 맞다. 여러 종목·종목 없는 블록(비교·보유종목·히트맵)은 그대로다.
 */
async function withDisplayName(
    block: ChatVisualBlock,
    locale: string
): Promise<ChatVisualBlock> {
    if (!('symbol' in block)) return block;
    const asset = await withTimeout(
        resolveAssetInfoOrNull(block.symbol, 'show_chart'),
        SHOW_CHART_NAME_TIMEOUT_MS,
        null
    );
    if (asset === null) return block;
    const name =
        locale === DEFAULT_LOCALE
            ? (asset.koreanName ?? asset.name)
            : asset.name;
    return { ...block, name };
}

/**
 * `show_chart` — 답변 아래에 그림 한 장을 붙인다. 서버가 데이터를 직접 읽어 블록을 만들고(모델은 숫자를 넘기지 않는다)
 * `runtime.emitChart`로 스트림·저장에 넘긴다. 모델에는 `{ rendered: true, kind, summary }`(그림과 같은 수치의 요약)만 간다.
 * 그릴 데이터가 없으면 `{ error: 'no_data', reason }`이고 블록은 내지 않는다.
 *
 * 블록 만들기는 {@link SHOW_CHART_TIMEOUT_MS}를 넘기면 포기하고, 직렬화 크기가 상한({@link CHAT_VISUAL_BLOCK_MAX_BYTES})을
 * 넘는 블록도 내보내지 않는다(저장 행이 커지지 않게). 절대 던지지 않는다 — 실패는 `no_data`다.
 * `portfolio`만 회원 전용이다(`login_required`); 나머지는 게스트도 쓴다.
 */
export const showChartTool: ToolExecutor = async (args, ctx, runtime) => {
    const { kind } = args;
    if (!isChartKind(kind)) return invalid('unknown chart kind');
    // 그림을 받아 줄 곳이 없는 실행(공개 API 등)에서는 읽기 전에 거절한다 — 데이터 조회만 낭비한다.
    if (runtime.emitChart === undefined) return noData('chart_not_supported');
    if (kind === 'portfolio' && isGuestSubject(ctx.userId))
        return { error: 'login_required' };
    const env: VisualBuildEnv = {
        locale: ctx.locale,
        userId: ctx.userId,
        allowUnofficialSources: runtime.allowUnofficialSources !== false,
        now: new Date(),
    };
    const outcome = await withTimeout(
        buildFor(kind, args, env).catch((error: unknown): VisualOutcome => {
            logToolDegrade('show_chart', kind, error);
            return noData('load_failed');
        }),
        SHOW_CHART_TIMEOUT_MS,
        noData('timeout')
    );
    if (isRefusal(outcome)) return outcome;
    const block = await withDisplayName(outcome.block, ctx.locale);
    // 상한은 바이트다 — `.length`는 UTF-16 단위라 한글(3바이트)이 많은 블록을 3배 가까이 작게 잰다.
    if (
        Buffer.byteLength(JSON.stringify(block), 'utf8') >
        CHAT_VISUAL_BLOCK_MAX_BYTES
    )
        return noData('block_too_large');
    // 클라이언트가 같은 가드로 못 그리는 블록을 버린다 — 서버가 내보내 놓고 모델이 "아래 차트"라고 말하면 안 된다.
    if (!isChatVisualBlock(block)) {
        logToolDegrade(
            'show_chart',
            kind,
            new Error('block failed client guard')
        );
        return noData('invalid_block');
    }
    runtime.emitChart(Promise.resolve(block));
    return { rendered: true, kind, summary: outcome.summary };
};
