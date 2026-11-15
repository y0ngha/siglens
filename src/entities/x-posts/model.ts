export type XAccountRole = 'company' | 'ceo';

/** 계정 후보: 큐레이션 표나 위키데이터에서 나온 핸들. X에서 확인하기 전이다. */
export interface XAccountCandidate {
    handle: string;
    role: XAccountRole;
    /** 사람 이름(CEO) — 출처가 준 값. 없으면 X 표시 이름을 쓴다. */
    name: string | null;
    /** 큐레이션 표에서 왔는가. 위키데이터 후보는 팔로워 하한을 넘어야 쓴다. */
    curated: boolean;
}

/** X에서 확인된(존재하고, 골라진) 계정. */
export interface ResolvedXAccount {
    userId: string;
    handle: string;
    name: string;
    role: XAccountRole;
    followers: number;
}

/** 도구 출력의 계정 행 — core `get_x_posts` 설명이 약속한 모양. */
export interface XPostsAccount {
    handle: string;
    name: string;
    role: XAccountRole;
    followers: number;
    /** 이번에 이 계정의 타임라인을 읽었는가. `false`면 아래 두 값은 `null`이다. */
    loaded: boolean;
    /** 읽은 한 페이지에 든 기간 안 원글 수. */
    postsInWindow: number | null;
    /** 기간 안에 읽지 않은 더 오래된 항목이 남았는가. */
    moreInWindow: boolean | null;
}

/** 도구 출력의 글 행. */
export interface XPostItem {
    handle: string;
    role: XAccountRole;
    /** ISO 8601 (UTC). */
    postedAt: string;
    text: string;
    truncated: boolean;
    url: string;
    likes: number;
    reposts: number;
}

/** X가 돌려준 글 하나(계정 정보 없이 — 같은 사용자를 여러 종목·역할이 나눠 쓴다). */
export interface XRawPost {
    id: string;
    text: string;
    /** ISO 8601 (UTC). */
    createdAt: string;
    likes: number;
    reposts: number;
}

/**
 * 계정 하나의 읽은 타임라인(캐시에 그대로 저장하는 모양). 사용자 ID로 키를 잡으므로 핸들·역할을 싣지 않는다 —
 * 그것은 읽는 쪽의 계정 정보로 붙인다(한 사용자가 종목 A에서는 회사 계정, B에서는 CEO 계정일 수 있다).
 */
export interface XAccountTimeline {
    /** 이 페이지를 X에서 읽은 시각(ISO). */
    fetchedAt: string;
    posts: XRawPost[];
    moreInWindow: boolean;
}
