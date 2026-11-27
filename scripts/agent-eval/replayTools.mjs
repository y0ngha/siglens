import { withLevelLadder } from '../../src/app/api/ai/chat/tools/getCachedAnalysis.ts';
// 저장 대화 재생(E1)의 도구 쪽: 기록된 도구 결과를 NEW 변형의 "해석 사실" 모양으로 바꿔 주는 순수 함수들.
//
// 네트워크·DB·LLM을 부르지 않는다. 변환은 앱의 **실제 수출 함수**(`withEarningsReactionTally`, `withPutCallReading`,
// `withLevelLadder`, `withPutCallValueReading`, `readHolderQuery`, `lookupHolder`)를 그대로 부른다 — 사본이 아니라 운영 코드로 NEW 결과를 만든다.
// 이 파일은 `node --conditions=react-server --import tsx`로 실행하는 스크래치 하네스(LLM 루프)가 import하거나,
// `replay.mjs` CLI가 쓴다. 입력 파일 모양은 README의 "저장 대화 재생" 절에 있다.
import { withEarningsReactionTally } from '../../src/app/api/ai/chat/tools/getFundamentals.ts';
import { readHolderQuery } from '../../src/app/api/ai/chat/tools/getInvestorFlows.ts';
import { withPutCallReading } from '../../src/app/api/ai/chat/tools/getOptionsSummary.ts';
import { previousQuarterEnd } from '../../src/entities/investor-flows/lib/investorFlowsDates.ts';
import { withPutCallValueReading } from '../../src/entities/investor-flows/lib/summary/institutional.ts';
import { lookupHolder } from '../../src/entities/investor-flows/server/getHolderLookup.ts';

/** 기록된 결과는 객체이거나 JSON 문자열이다. 파싱이 안 되면(절단) null. */
export function parseRecorded(value) {
    if (typeof value !== 'string')
        return typeof value === 'object' ? value : null;
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 호출에 맞는 기록을 찾는다: 이름+인자 전부 같음 → 이름+심볼+타임프레임(+탭) 같음 → 없음(null).
 * `used`에 이미 돌려준 기록의 인덱스를 담아 같은 호출이 반복되면 다음 기록을 준다.
 */
export function matchRecorded(recorded, name, args, used = new Set()) {
    const pick = predicate => {
        const index = recorded.findIndex(
            (r, i) => !used.has(i) && r.name === name && predicate(r.args ?? {})
        );
        return index === -1 ? null : index;
    };
    const keyOf = a => [
        a.symbol ?? a.symbols ?? null,
        a.timeframe ?? null,
        a.tab ?? null,
    ];
    const exact = pick(a => sameJson(a, args));
    if (exact !== null) return { index: exact, level: 'exact' };
    const loose = pick(a => sameJson(keyOf(a), keyOf(args)));
    return loose === null
        ? null
        : { index: loose, level: 'name+symbol+timeframe' };
}

/**
 * 기록된 `get_bars_indicators` 결과가 찍은 값으로 사다리의 차트 기준을 만든다(두 도구가 같은 값을 찍는다는 것은
 * 앱 테스트가 고정한다). 일봉이 아니거나 값이 없으면 null.
 */
export function chartReferenceFromBarsResult(bars) {
    if (bars === null || bars === undefined) return null;
    if (bars.timeframe !== '1Day') return null;
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const chart = {
        high52w: num(bars.derived?.range?.high),
        low52w: num(bars.derived?.range?.low),
        high20: num(bars.derived?.ranges?.['20bars']?.high),
        low20: num(bars.derived?.ranges?.['20bars']?.low),
        sma20: num(bars.latest?.ma?.['20']),
        sma50: num(bars.latest?.ma?.['50']),
        sma200: num(bars.latest?.ma?.['200']),
    };
    return Object.values(chart).every(v => v === null) ? null : chart;
}

/** 13F 풋/콜 블록에 운영의 `withPutCallValueReading`으로 `reading`을 끼운다(기록에 풋/콜 블록이 없으면 그대로). */
function withFlowsReading(result) {
    const putCall = result.institutional?.putCall;
    if (putCall === null || putCall === undefined) return result;
    return {
        ...result,
        institutional: {
            ...result.institutional,
            putCall: withPutCallValueReading(putCall),
        },
    };
}

/**
 * 기록된 13F 데이터(`holderData[심볼]`)를 읽는 `lookupHolder`용 메모리 읽기. 이름 후보 좁히기·이전 분기 조인·"담을 수 있었나"
 * 판정은 저장소 SQL과 같은 규칙을 JS로 옮긴 것이고, 이름 매칭과 상태 결정은 운영 `lookupHolder`가 한다.
 */
export function buildHolderReads(holderData) {
    const forCusip = cusip =>
        Object.values(holderData).find(d => d.cusip === cusip) ?? null;
    const nameOf = (d, cik) =>
        d.filers.find(f => f.cik === cik)?.name ?? String(cik);
    return {
        findCusipsBySymbol: async symbol => {
            const d = holderData[symbol];
            return d === undefined ? [] : [d.cusip];
        },
        findAggregates: async (cusip, limit) =>
            (forCusip(cusip)?.aggregates ?? [])
                .toSorted((a, b) => b.period.localeCompare(a.period))
                .slice(0, limit),
        findLatestPositionPeriod: async cusip => {
            const d = forCusip(cusip);
            if (d === null) return null;
            return (
                d.latestPositionPeriod ??
                d.positions
                    .map(p => p.period)
                    .toSorted()
                    .at(-1) ??
                null
            );
        },
        findFilersByNameTokens: async (tokens, limit) => {
            // 저장소 SQL과 같이 `AND` 토큰(`&`의 정규화)은 원본 이름에 없으므로 후보 필터에서 뺀다.
            const likeTokens = tokens.filter(t => t !== 'AND');
            if (likeTokens.length === 0) return [];
            const all = Object.values(holderData).flatMap(d => d.filers);
            const seen = new Set();
            return all
                .filter(f =>
                    likeTokens.every(t => f.name.toUpperCase().includes(t))
                )
                .filter(f =>
                    seen.has(f.cik) ? false : (seen.add(f.cik), true)
                )
                .toSorted(
                    (a, b) =>
                        a.name.length - b.name.length ||
                        a.name.localeCompare(b.name)
                )
                .slice(0, limit);
        },
        findHolderPositions: async (cusip, period, ciks) => {
            const d = forCusip(cusip);
            if (d === null) return [];
            const prev = previousQuarterEnd(period);
            return d.positions
                .filter(p => p.period === period && ciks.includes(p.cik))
                .toSorted((a, b) => b.shares - a.shares)
                .map(p => ({
                    cik: p.cik,
                    filerName: nameOf(d, p.cik),
                    shares: p.shares,
                    valueUsd: p.valueK * 1000,
                    prevShares:
                        d.positions.find(
                            q => q.cik === p.cik && q.period === prev
                        )?.shares ?? null,
                }));
        },
        findFilerFilings: async (cusip, ciks, period) => {
            const d = forCusip(cusip);
            if (d === null) return [];
            const created = Date.parse(d.cusipCreatedAt);
            return d.filings
                .filter(f => f.period === period && ciks.includes(f.cik))
                .map(f => ({
                    cik: f.cik,
                    processed: f.processed === true,
                    couldListCusip:
                        f.universeStamp !== null &&
                        f.universeStamp !== undefined &&
                        Date.parse(f.universeStamp) >= created,
                }));
        },
        countHoldersAbove: async (cusip, period, shares) =>
            (forCusip(cusip)?.positions ?? []).filter(
                p => p.period === period && p.shares > shares
            ).length,
    };
}

/**
 * 한 케이스의 도구 실행기. `variant`가 `old`면 기록을 그대로, `new`면 해석 사실을 얹어 돌려준다.
 * 호출이 기록에 없으면 `{ error: 'replay_miss' }`를 돌려주고 `misses`에 남긴다. `holder` 인자가 있는 `get_investor_flows`는
 * `holderData`가 있을 때만 `holderLookup`을 얹는다.
 */
export function makeReplayExecutor(
    caseRecord,
    { variant, holderData = {}, today }
) {
    // 호출마다 값을 새로 만들어 갈아 끼운다(배열·집합을 제자리에서 바꾸지 않는다). 호출자는 getter로 읽는다.
    const state = { used: new Set(), misses: [], matches: [] };
    const parsedAt = index => parseRecorded(caseRecord.recorded[index]?.result);
    const barsFor = symbol =>
        caseRecord.recorded
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.name === 'get_bars_indicators')
            .map(({ i }) => parsedAt(i))
            .find(b => b !== null && (b.symbol ?? symbol) === symbol) ?? null;

    const enrich = async (name, args, result) => {
        if (name === 'get_fundamentals')
            return withEarningsReactionTally(result);
        if (name === 'get_options_summary')
            return result.metrics === undefined
                ? result
                : { ...result, metrics: withPutCallReading(result.metrics) };
        if (name === 'get_cached_analysis')
            // 운영과 같이 차트 기준은 일봉 분석(`result.timeframe === '1Day'`)에만 얹는다.
            return withLevelLadder(
                result,
                result.timeframe === '1Day'
                    ? chartReferenceFromBarsResult(
                          barsFor(String(args.symbol ?? '').toUpperCase())
                      )
                    : null
            );
        if (name === 'get_investor_flows') {
            const withReading = withFlowsReading(result);
            const query = readHolderQuery(args.holder);
            if (query === null || Object.keys(holderData).length === 0)
                return withReading;
            const holderLookup = await lookupHolder(
                buildHolderReads(holderData),
                {
                    symbol: String(args.symbol ?? '').toUpperCase(),
                    query,
                    today,
                    // 운영과 같이 같은 결과의 보유 기관 목록이 쓴 분기를 따른다(없으면 조회가 스스로 고른다).
                    period: result.institutional?.topHoldersPeriod ?? null,
                }
            );
            return { ...withReading, holderLookup };
        }
        return result;
    };

    const execute = async (name, args) => {
        const match = matchRecorded(
            caseRecord.recorded,
            name,
            args,
            state.used
        );
        if (match === null) {
            state.misses = [...state.misses, { name, args }];
            return { error: 'replay_miss' };
        }
        state.used = new Set([...state.used, match.index]);
        state.matches = [...state.matches, { name, level: match.level }];
        const recordedResult = parsedAt(match.index);
        // 절단된 기록(JSON이 아님)은 변환할 수 없다 — 그대로 문자열을 돌려주고 호출자가 센다.
        if (recordedResult === null)
            return caseRecord.recorded[match.index].result;
        return variant === 'new'
            ? enrich(name, args, recordedResult)
            : recordedResult;
    };
    return {
        execute,
        get misses() {
            return state.misses;
        },
        get matches() {
            return state.matches;
        },
    };
}
