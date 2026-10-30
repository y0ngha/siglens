/**
 * 받아 온 활성 공지 중 지금 띄울 공지 큐를 고르는 순수 헬퍼.
 */
import { matchPath } from '@/entities/notice/lib/matchPath';
import type { NoticeRecord } from '@/entities/notice/model/types';

/** 큐에서 빼야 할 공지를 정하는 입력 — 현재 경로와 두 종류의 "이미 본" ID 집합. */
export interface NoticeQueueFilter {
    /** 로케일 접두사를 뗀 경로. `notices.path_pattern`이 접두사 없는 경로라서다. */
    pathname: string;
    /** "다시 보지 않기"로 영구 제외한 ID(localStorage). */
    dismissedIds: ReadonlySet<string>;
    /** 이번 세션에 닫은 ID — 새로고침하면 비워져 다시 뜬다. */
    consumedIds: ReadonlySet<string>;
}

/**
 * 경로가 맞고, 영구 dismiss도 세션 소비도 되지 않은 공지만 서버 순서(우선순위 정렬 완료)
 * 그대로 남긴다. 큐의 첫 원소가 지금 보이는 공지다.
 */
export function selectNoticeQueue(
    notices: readonly NoticeRecord[],
    { pathname, dismissedIds, consumedIds }: NoticeQueueFilter
): NoticeRecord[] {
    return notices.filter(
        notice =>
            matchPath(notice.pathPattern, pathname) &&
            !dismissedIds.has(notice.id) &&
            !consumedIds.has(notice.id)
    );
}
