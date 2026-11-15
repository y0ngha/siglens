import 'server-only';
import type { XPostItem } from '@/entities/x-posts/model';
import { getXPosts } from '@/entities/x-posts/server/getXPosts';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { isGuestSubject } from '../guestSubject';
import { X_POSTS_RESULT_MAX_CHARS } from './truncate';

const SOURCE = 'X';

/** 글이 가장 많은 계정의 가장 오래된 글 하나를 뺀다(동률이면 목록에서 더 뒤에 있는 글). */
function dropOneFromBusiestAccount(posts: readonly XPostItem[]): XPostItem[] {
    const counts = new Map<string, number>();
    for (const post of posts)
        counts.set(post.handle, (counts.get(post.handle) ?? 0) + 1);
    const busiest = Math.max(...counts.values());
    const index = posts.findLastIndex(
        post => counts.get(post.handle) === busiest
    );
    return posts.filter((_, i) => i !== index);
}

/**
 * 결과가 상한을 넘으면 글이 가장 많은 계정부터 그 계정의 가장 오래된 글을 하나씩 뺀다 — 전체에서 가장 오래된 글을
 * 빼면 한 계정의 글이 통째로 사라질 수 있다(`mergeXPosts`가 막으려는 쏠림). 상한은 실측 최악에 여유를 둔 값이라
 * 보통 닿지 않지만, 줄바꿈·따옴표가 많은 글은 JSON 이스케이프로 더 길어진다 — 그때 레지스트리의 일반 절단에
 * 맡기면 결과 전체가 앞부분 미리보기 덩어리로 무너진다. 빠진 글은 계정의 `postsInWindow`가 실린 글 수보다 큰
 * 것으로 드러난다(core 설명의 규칙). 글이 최대 12건이라 반복 직렬화는 많아야 12번이다.
 */
function fitPosts<T extends { posts: XPostItem[] }>(result: T): T {
    let fitted = result;
    while (
        fitted.posts.length > 0 &&
        JSON.stringify(fitted).length > X_POSTS_RESULT_MAX_CHARS
    )
        fitted = { ...fitted, posts: dropOneFromBusiestAccount(fitted.posts) };
    return fitted;
}

/**
 * 종목의 회사 공식 X 계정과 CEO 계정이 최근에 올린 원글.
 *
 * 턴당 호출 횟수는 core가 세고(`AGENT_TURN_CAPS.maxXPostCalls`), 하루 전역 예산(게스트는 그 안의 게스트 몫까지)은
 * 엔티티가 센다. X 키가 없으면 이 실행기는 모델에 노출되지 않는다(`availableToolNames`). 계정을 모르면
 * `no_known_account`, X·위키데이터·예산 저장소 실패는 `provider_failed`, 하루 예산 초과는
 * `{ error: 'quota', scope: 'global_day' }`다. 예외 메시지는 결과에 싣지 않는다(엔티티가 이름·상태만 로그로 남긴다).
 */
export const getXPostsTool: ToolExecutor = async (args, ctx) => {
    const symbol = String(args.symbol).toUpperCase();
    const result = await getXPosts(symbol, {
        guest: isGuestSubject(ctx.userId),
    });
    if (result.status === 'quota')
        return { error: 'quota', scope: 'global_day' };
    if (result.status !== 'ok')
        return { symbol, available: false, reason: result.status };
    return fitPosts({
        asOf: result.asOf,
        source: SOURCE,
        symbol,
        available: true,
        accounts: result.accounts,
        posts: result.posts,
    });
};
