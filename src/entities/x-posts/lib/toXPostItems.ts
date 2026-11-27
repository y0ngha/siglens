import {
    AGENT_X_POSTS_WINDOW_DAYS,
    AGENT_X_POST_TEXT_MAX_CHARS,
} from '@/entities/x-posts/lib/xPostsConstants';
import { MS_PER_DAY } from '@/shared/config/time';
import { sliceUtf16 } from '@/shared/lib/sliceUtf16';
import type { XAccountRole, XPostItem, XRawPost } from '../model';

/** X API는 본문의 `&`, `<`, `>`만 엔티티로 바꿔 보낸다. `&amp;`를 마지막에 풀어 `&amp;lt;`가 `<`가 되지 않게 한다. */
function decodeXEntities(text: string): string {
    return text
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');
}

/** 기간의 시작 시각(`now` − `AGENT_X_POSTS_WINDOW_DAYS`일). X 요청의 `start_time`과 결과 검증이 같은 값을 쓴다. */
export function xPostsWindowStart(now: Date): Date {
    return new Date(now.getTime() - AGENT_X_POSTS_WINDOW_DAYS * MS_PER_DAY);
}

/**
 * 계정 하나의 X 글을 도구 출력 행으로 바꾼다(최신순). 기간 밖 글은 버리고(요청에 `start_time`을 실었어도 응답을
 * 그대로 믿지 않는다 — SERVER.md#SA-13), 본문은 엔티티를 풀고 공백 끝을 다듬은 뒤 `AGENT_X_POST_TEXT_MAX_CHARS`자에서
 * 자른다. 캐시에서 꺼낸 글에도 매번 적용하므로 기간 경계는 읽는 시각 기준이다.
 */
export function toXPostItems(
    account: { handle: string; role: XAccountRole },
    posts: readonly XRawPost[],
    now: Date
): XPostItem[] {
    const startMs = xPostsWindowStart(now).getTime();
    return posts
        .flatMap((post): XPostItem[] => {
            const postedMs = Date.parse(post.createdAt);
            if (Number.isNaN(postedMs) || postedMs < startMs) return [];
            const cut = sliceUtf16(
                decodeXEntities(post.text).trim(),
                AGENT_X_POST_TEXT_MAX_CHARS
            );
            const text = cut.text.trimEnd();
            if (text === '') return [];
            return [
                {
                    handle: account.handle,
                    role: account.role,
                    postedAt: new Date(postedMs).toISOString(),
                    text,
                    truncated: cut.cut,
                    url: `https://x.com/${account.handle}/status/${post.id}`,
                    likes: post.likes,
                    reposts: post.reposts,
                },
            ];
        })
        .toSorted((a, b) => b.postedAt.localeCompare(a.postedAt));
}
