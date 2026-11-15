import type { XPostItem } from '../model';

/**
 * 여러 계정의 글(각각 최신순)을 `max`건으로 합쳐 최신순으로 돌려준다.
 *
 * 최신순으로만 자르면 글이 잦은 계정이 다른 계정을 통째로 밀어낸다(CEO가 하루에 열 건 올리면 회사 계정의 글이
 * 하나도 남지 않는다). 그래서 계정마다 `max / 계정 수`건을 먼저 보장하고, 남는 자리를 나머지 글 중 최신 것으로 채운다.
 */
export function mergeXPosts(
    perAccount: readonly (readonly XPostItem[])[],
    max: number
): XPostItem[] {
    const lists = perAccount.filter(list => list.length > 0);
    if (lists.length === 0 || max <= 0) return [];
    const share = Math.floor(max / lists.length);
    const guaranteed = lists.flatMap(list => list.slice(0, share));
    const rest = lists
        .flatMap(list => list.slice(share))
        .toSorted((a, b) => b.postedAt.localeCompare(a.postedAt));
    return [...guaranteed, ...rest.slice(0, max - guaranteed.length)].toSorted(
        (a, b) => b.postedAt.localeCompare(a.postedAt)
    );
}
