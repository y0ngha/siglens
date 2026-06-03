'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useState,
} from 'react';
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
 * 공지 팝업 데이터 훅. 마운트 시 1회 활성 공지를 fetch하고, pathname 변경 또는
 * 공지 목록 갱신 시 경로 매칭 + localStorage dismiss 필터로 노출 큐를 재구성한다.
 */
export function useNoticePopup(pathname: string): UseNoticePopupResult {
    const [allNotices, setAllNotices] = useState<NoticeRecord[]>([]);
    const [queue, setQueue] = useState<NoticeRecord[]>([]);

    const advance = useCallback(() => setQueue(prev => prev.slice(1)), []);

    // B1: setState 업데이터 내부에서 사이드이펙트(dismissNotice) 호출 금지.
    // 업데이터 밖에서 현재 공지를 dismiss한 뒤 큐를 진행한다.
    const dontShowAgain = useCallback(() => {
        const cur = queue[0];
        if (cur) dismissNotice(cur.id);
        setQueue(prev => prev.slice(1));
    }, [queue]);

    const rebuildQueue = useEffectEvent(() => {
        const dismissed = loadDismissedNoticeIds();
        startTransition(() => {
            setQueue(
                allNotices.filter(
                    n =>
                        matchPath(n.pathPattern, pathname) &&
                        !dismissed.includes(n.id)
                )
            );
        });
    });

    useEffect(() => {
        let cancelled = false;
        getActiveNoticesAction()
            .then(notices => {
                if (!cancelled) setAllNotices(notices);
            })
            .catch(() => {
                // 공지 fetch 실패는 무시(부가 기능)
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // rebuildQueue는 useEffectEvent 결과(stable 참조)이므로 deps 배열에서 의도적으로
    // 제외한다. react-hooks/exhaustive-deps가 이 패턴을 인식해 경고하지 않는다(lint 통과).
    // MISTAKES.md Predictability §3.
    useEffect(() => {
        rebuildQueue();
    }, [pathname, allNotices]);

    return { queue, advance, dontShowAgain };
}
