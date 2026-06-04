'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import { matchPath, type NoticeRecord } from '@/entities/notice';
import { loadDismissedNoticeIds, dismissNotice } from '../utils/noticeStorage';

/** useNoticePopup의 반환 형태 — 노출 큐와 큐 진행 핸들러. */
export interface UseNoticePopupResult {
    queue: NoticeRecord[];
    advance: () => void;
    dontShowAgain: () => void;
}

/**
 * 큐를 effect+setState가 아니라 `useMemo`로 파생하는 이유: 이전 구현은 effect에서
 * `setQueue`를 호출했고, lint(`react-hooks/set-state-in-effect`)를 피하려 `startTransition`
 * 으로 감쌌다. 그 낮은 우선순위 업데이트가 무거운 client 페이지(종목 차트/AI 스트리밍)의
 * 렌더에 밀려 Chrome(Blink)에서 공지 노출이 ~10초+ 지연(starvation)되는 회귀가 있었다
 * (Safari/WebKit은 즉시 — 실측 확인). 렌더 중 파생으로 urgent 반영 + effect-setState
 * 제거를 동시에 달성한다.
 *
 * 큐 진행(advance/dontShowAgain)은 모두 세션 한정 `consumedIds`(state)로 일원화한다.
 * "닫기"는 consumed만 추가(새로고침 시 리셋 → 재노출), "다시 보지 않기"는 추가로
 * localStorage에 영구 dismiss한다(새로고침 후에도 제외).
 */
export function useNoticePopup(pathname: string): UseNoticePopupResult {
    const [allNotices, setAllNotices] = useState<NoticeRecord[]>([]);
    const [consumedIds, setConsumedIds] = useState<readonly string[]>([]);

    // consumedIds 변경 시 재계산되며, 그때 localStorage(dismissed)도 최신으로 재평가한다.
    // dismissed는 deps에 없지만, 이 훅에서 dismissed에 쓰는 유일한 경로인 dontShowAgain이
    // 항상 consumedIds를 함께 bump하므로(아래), consumedIds 변경 → 재계산 시 최신 dismissed를
    // 다시 읽어 세션 내 stale이 불가능하다. advance는 localStorage를 건드리지 않으므로 재읽기가
    // 불필요하다.
    const queue = useMemo<NoticeRecord[]>(() => {
        const dismissed = loadDismissedNoticeIds();
        return allNotices.filter(
            n =>
                matchPath(n.pathPattern, pathname) &&
                !dismissed.includes(n.id) &&
                !consumedIds.includes(n.id)
        );
    }, [allNotices, pathname, consumedIds]);

    const consume = useCallback((id: string) => {
        setConsumedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    // X / 배경 클릭 / Esc / "닫기": 세션 한정 소비(다음 방문 시 재노출).
    const advance = useCallback(() => {
        const cur = queue[0];
        if (cur !== undefined) consume(cur.id);
    }, [queue, consume]);

    // "다시 보지 않기": localStorage 영구 dismiss + 세션 소비.
    const dontShowAgain = useCallback(() => {
        const cur = queue[0];
        if (cur === undefined) return;
        dismissNotice(cur.id);
        consume(cur.id);
    }, [queue, consume]);

    // 활성 공지 fetch는 외부 시스템 동기화 effect. canonical hook order(effects last)에 따라
    // useMemo/useCallback 뒤에 둔다.
    useEffect(() => {
        let cancelled = false;
        getActiveNoticesAction()
            .then(notices => {
                if (!cancelled) setAllNotices(notices);
            })
            .catch(err => {
                // 공지 fetch 실패는 무시(부가 기능)하되 디버깅 가능하도록 warn
                console.warn('[useNoticePopup] fetch notices failed:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { queue, advance, dontShowAgain };
}
