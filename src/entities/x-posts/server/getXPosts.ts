import 'server-only';
import {
    AGENT_X_POSTS_MAX,
    AGENT_X_POSTS_PAGE_SIZE,
} from '@y0ngha/siglens-core';
import { fetchStockXAccounts } from '@/shared/api/wikidata/stockXAccounts';
import {
    fetchXTimelinePage,
    fetchXUsersByUsernames,
    xBearerToken,
    XApiError,
} from '@/shared/api/x/xClient';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { readErrorCode } from '@/shared/lib/readErrorCode';
import { CURATED_X_ACCOUNTS } from '../lib/curatedXAccounts';
import { mergeXPosts } from '../lib/mergeXPosts';
import {
    isFullyCurated,
    pickXAccounts,
    xAccountCandidates,
} from '../lib/pickXAccounts';
import { toXPostItems, xPostsWindowStart } from '../lib/toXPostItems';
import type {
    ResolvedXAccount,
    XAccountTimeline,
    XPostItem,
    XPostsAccount,
} from '../model';
import { refundXReads, reserveXReads } from './xDailyBudget';

/**
 * 시간 예산(SERVER.md#CC-7): 위키데이터 3초 + X 사용자 조회 4초 + 타임라인 5초(계정들은 동시에 읽는다) = 최악 12초.
 * core의 `TOOL_TIMEOUT_MS.external`(15초) 안이다. Redis 왕복은 그 여유(3초)에 든다. 같은 키를 먼저 읽기 시작한 요청을
 * 기다리는 경우(`getOrSetCache`의 in-flight 공유)도 그 요청이 같은 타임아웃에 묶여 있으므로 더 늦어지지 않는다.
 * 시장 프로필은 조회하지 않는다(캐시 미스 때 DB·FMP를 타 예산 밖으로 샌다): 위키데이터 질의가 미국 거래소 상장만 보고
 * 큐레이션 표도 미국 종목뿐이라, 크립토·ETF 같은 심볼은 후보가 없어 `no_known_account`로 끝난다.
 */

/** 종목의 계정 묶음. 키 접두사의 버전은 저장하는 값의 모양이 바뀔 때 올린다. */
const X_ACCOUNTS_CACHE_KEY_PREFIX = 'x:accounts:v1';
/** 계정 하나의 읽은 타임라인(`XAccountTimeline`). 사용자 ID로 키를 잡아 여러 종목이 같은 계정을 나눠 쓴다. */
const X_TIMELINE_CACHE_KEY_PREFIX = 'x:timeline:v1';
/** 계정이 바뀌는 일은 드물다. 팔로워 수도 이 주기로만 갱신된다. */
const X_ACCOUNTS_CACHE_TTL_SECONDS = 7 * SECONDS_PER_DAY;
/** 계정을 못 찾은 결과는 하루 뒤 다시 찾는다(위키데이터에 새로 실릴 수 있다). */
const X_ACCOUNTS_NONE_TTL_SECONDS = SECONDS_PER_DAY;
/**
 * 위키데이터가 실패해 큐레이션 표만으로 채운 결과(`partial`)는 짧게 둔다. 그동안 위키데이터로 찾아야 할 역할(보통 CEO)이
 * 빠진 채 답한다 — 출력에는 "찾지 못함"을 나타낼 칸이 없으므로 그 구간을 줄이는 것이 할 수 있는 전부다.
 */
const X_ACCOUNTS_PARTIAL_TTL_SECONDS = 10 * SECONDS_PER_MINUTE;
/** 같은 계정을 한 시간에 한 번만 읽는다 — 같은 질문이 반복돼도 과금은 한 번이다. 답은 최대 한 시간 늦다. */
const X_TIMELINE_CACHE_TTL_SECONDS = SECONDS_PER_HOUR;

/** 캐시에 저장하는 계정 묶음. `partial`은 위키데이터 조회가 실패해 큐레이션 표만으로 채웠다는 뜻이다. */
interface CachedXAccounts {
    accounts: ResolvedXAccount[];
    partial: boolean;
}

type XPostsResult =
    | {
          status: 'ok';
          /** 실린 타임라인 중 가장 먼저 읽은 것의 시각 — 캐시된 글이 얼마나 묵었는지 그대로 드러낸다. */
          asOf: string;
          accounts: XPostsAccount[];
          posts: XPostItem[];
      }
    | { status: 'no_known_account' }
    | { status: 'provider_failed' }
    | { status: 'quota' };

/** 하루 예산이 다 찼다. */
class XBudgetExhaustedError extends Error {
    constructor() {
        super('x daily read budget exhausted');
        this.name = 'XBudgetExhaustedError';
    }
}

/** 예산 저장소(Redis)를 쓸 수 없다 — 세지 못하므로 X를 부르지 않는다. */
class XBudgetUnavailableError extends Error {
    constructor() {
        super('x budget store unavailable');
        this.name = 'XBudgetUnavailableError';
    }
}

/** 오류 객체·메시지는 남기지 않는다(메시지에 URL이 들어갈 수 있다). 이름·상태·짧은 코드만. */
function logDegrade(step: string, error: unknown): void {
    console.error('[xPosts]', `${step} failed`, {
        errorName: error instanceof Error ? error.name : 'unknown',
        status: error instanceof XApiError ? error.status : undefined,
        code: readErrorCode(error),
    });
}

/**
 * X 요청 하나를 하루 예산 아래에서 실행한다. 요청이 읽을 수 있는 최대 수(`worstCase`)를 먼저 예약하고, X가 돌려준
 * 항목 수(`billed`, 최소 1 — 빈 응답도 한 건으로 센다)와의 차이를 돌려준다.
 *
 * 실패는 `XApiError.billing`으로 정한다: `none`(보내지 않았거나 HTTP 오류)은 전부 돌려주고, `unknown`(타임아웃·
 * 연결 실패·쓸 수 없는 200 본문)과 그 밖의 예외는 돌려주지 않는다 — X가 처리했는지 모를 때는 덜 쓰는 쪽으로 틀린다.
 */
async function withReservedReads<T>(
    worstCase: number,
    guest: boolean,
    run: () => Promise<{ value: T; billed: number }>
): Promise<T> {
    const options = { guest, now: new Date() };
    const reservation = await reserveXReads(worstCase, options);
    if (reservation === 'exhausted') throw new XBudgetExhaustedError();
    if (reservation === 'unavailable') throw new XBudgetUnavailableError();
    try {
        const { value, billed } = await run();
        await refundXReads(worstCase - Math.max(1, billed), options);
        return value;
    } catch (error) {
        if (error instanceof XApiError && error.billing === 'none')
            await refundXReads(worstCase, options);
        throw error;
    }
}

/**
 * 종목의 회사·CEO 계정. 큐레이션 표 → 위키데이터 순으로 후보를 모아 X에서 확인한다(존재 여부·팔로워 수).
 * 위키데이터가 실패해도 큐레이션 표에 이 종목이 있으면 그것만으로 진행하고(`partial`), 없으면 던진다 —
 * "계정이 없다"와 "찾지 못했다"를 섞지 않는다.
 */
function loadXAccounts(
    symbol: string,
    guest: boolean
): Promise<CachedXAccounts> {
    return getOrSetCache<CachedXAccounts>(
        `${X_ACCOUNTS_CACHE_KEY_PREFIX}:${symbol}`,
        value => {
            if (value.partial) return X_ACCOUNTS_PARTIAL_TTL_SECONDS;
            return value.accounts.length === 0
                ? X_ACCOUNTS_NONE_TTL_SECONDS
                : X_ACCOUNTS_CACHE_TTL_SECONDS;
        },
        async () => {
            const curated = CURATED_X_ACCOUNTS[symbol] !== undefined;
            const wikidata = isFullyCurated(symbol)
                ? null
                : await fetchStockXAccounts(symbol).catch((error: unknown) => {
                      if (!curated) throw error;
                      logDegrade('wikidata lookup', error);
                      return null;
                  });
            const partial = wikidata === null && !isFullyCurated(symbol);
            const candidates = xAccountCandidates(symbol, wikidata);
            if (candidates.length === 0) return { accounts: [], partial };
            const users = await withReservedReads(
                candidates.length,
                guest,
                async () => {
                    const found = await fetchXUsersByUsernames(
                        candidates.map(candidate => candidate.handle)
                    );
                    return { value: found.users, billed: found.billedItems };
                }
            );
            return { accounts: pickXAccounts(candidates, users), partial };
        }
    );
}

/** 계정 하나의 최신 한 페이지(원글 그대로). 실패와 예산 초과는 던져서 캐시에 남지 않는다. */
function loadXTimeline(
    account: ResolvedXAccount,
    guest: boolean
): Promise<XAccountTimeline> {
    return getOrSetCache<XAccountTimeline>(
        `${X_TIMELINE_CACHE_KEY_PREFIX}:${account.userId}`,
        X_TIMELINE_CACHE_TTL_SECONDS,
        () =>
            withReservedReads(AGENT_X_POSTS_PAGE_SIZE, guest, async () => {
                const now = new Date();
                const page = await fetchXTimelinePage(account.userId, {
                    startTime: xPostsWindowStart(now),
                    pageSize: AGENT_X_POSTS_PAGE_SIZE,
                });
                return {
                    value: {
                        fetchedAt: now.toISOString(),
                        posts: page.posts,
                        moreInWindow: page.hasMore,
                    },
                    billed: page.billedItems,
                };
            })
    );
}

/** 한 턴에 같은 사유를 계정마다 찍지 않도록, 예산 사유는 표식 로그(`xDailyBudget`)에 맡기고 그 밖의 실패만 남긴다. */
function isBudgetError(error: unknown): boolean {
    return (
        error instanceof XBudgetExhaustedError ||
        error instanceof XBudgetUnavailableError
    );
}

/**
 * 종목의 회사 공식 계정과 CEO 계정이 최근에 올린 원글. 미국 주식만 대상이다(위키데이터 조회가 미국 거래소 상장만 본다).
 *
 * - 계정을 모르면 `no_known_account`, 계정 찾기나 모든 계정 읽기가 실패하면 `provider_failed`.
 * - 하루 예산이 차서 아무 계정도 읽지 못했으면 `quota`. 일부만 읽었으면 `ok`이고 못 읽은 계정은 `loaded: false`다.
 * - 캐시에 있는 계정·타임라인은 예산을 쓰지 않는다. 게스트 요청은 전체 예산과 별도의 게스트 몫을 함께 쓴다.
 *
 * 절대 던지지 않는다.
 */
export async function getXPosts(
    symbol: string,
    { guest }: { guest: boolean }
): Promise<XPostsResult> {
    if (xBearerToken() === null) return { status: 'provider_failed' };
    if (isKrEquitySymbol(symbol)) return { status: 'no_known_account' };
    let accounts: ResolvedXAccount[];
    try {
        ({ accounts } = await loadXAccounts(symbol, guest));
    } catch (error) {
        if (error instanceof XBudgetExhaustedError) return { status: 'quota' };
        if (!isBudgetError(error)) logDegrade('account lookup', error);
        return { status: 'provider_failed' };
    }
    if (accounts.length === 0) return { status: 'no_known_account' };

    const settled = await Promise.allSettled(
        accounts.map(account => loadXTimeline(account, guest))
    );
    const now = new Date();
    const timelines = settled.map((result, index) =>
        result.status === 'fulfilled'
            ? {
                  fetchedAt: result.value.fetchedAt,
                  moreInWindow: result.value.moreInWindow,
                  posts: toXPostItems(accounts[index], result.value.posts, now),
              }
            : null
    );
    const failures = settled.flatMap((result): unknown[] =>
        result.status === 'rejected' ? [result.reason] : []
    );
    for (const failure of failures)
        if (!isBudgetError(failure)) logDegrade('timeline', failure);

    const loaded = timelines.filter(timeline => timeline !== null);
    if (loaded.length === 0)
        return failures.some(
            failure => failure instanceof XBudgetExhaustedError
        )
            ? { status: 'quota' }
            : { status: 'provider_failed' };

    return {
        status: 'ok',
        asOf: loaded
            .map(timeline => timeline.fetchedAt)
            .toSorted((a, b) => a.localeCompare(b))[0],
        accounts: accounts.map((account, index): XPostsAccount => {
            const timeline = timelines[index];
            return {
                handle: account.handle,
                name: account.name,
                role: account.role,
                followers: account.followers,
                loaded: timeline !== null,
                postsInWindow: timeline?.posts.length ?? null,
                moreInWindow: timeline?.moreInWindow ?? null,
            };
        }),
        posts: mergeXPosts(
            loaded.map(timeline => timeline.posts),
            AGENT_X_POSTS_MAX
        ),
    };
}
