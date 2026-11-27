/*
 * `get_x_posts`의 출력 계약 숫자. 도구 설명(`features/agent-tools/spec/getXPosts.ts`)이 이 값을 그대로 말하고 이
 * 엔티티의 조회·정리 코드가 그대로 지킨다. 원래 core가 내보내던 값(같은 이름·같은 값)이고, 도구 문구가 siglens로
 * 옮겨 오면서 데이터 소스를 가진 이 엔티티로 왔다.
 */

/** `get_x_posts` 한 번이 회사·CEO 계정을 통틀어 돌려주는 최대 글 수. */
export const AGENT_X_POSTS_MAX = 12;

/** `get_x_posts`가 거슬러 보는 기간(일). */
export const AGENT_X_POSTS_WINDOW_DAYS = 14;

/**
 * 계정마다 X에 요청하는 글 수. X는 읽은 글마다 과금하고 타임라인을 페이지로 주므로, 이 크기의 한 페이지만 읽고
 * 기간에 글이 더 있는지(`moreInWindow`)만 알린다 — 세려고 더 읽지 않는다.
 */
export const AGENT_X_POSTS_PAGE_SIZE = 10;

/** 돌려주는 글 `text`의 최대 길이(문자). 더 긴 글은 잘리고 `truncated`가 붙는다. */
export const AGENT_X_POST_TEXT_MAX_CHARS = 600;
