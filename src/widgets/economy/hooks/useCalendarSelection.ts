'use client';

/**
 * 경제 캘린더 날짜 선택 훅 — 오늘(KST) 갱신, 기본 선택일 동기화, 사용자 선택과 상세 패널 스크롤.
 */
import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import type { DayGroup } from '../model/calendarTypes';
import { pickDefaultDateKey } from '../utils/calendarGrouping';

interface UseCalendarSelectionInput {
    groups: readonly DayGroup[];
    /** 서버가 ISR로 구운 오늘(KST 'YYYY-MM-DD'). 비어 있으면 가장 이른 날을 기본으로. */
    today: string;
    /** 기본 선택일을 고를 때 볼 활성 중요도 — 바뀌어도 선택을 다시 고르지는 않는다. */
    activeImpacts: ReadonlySet<CalendarImpact>;
}

interface UseCalendarSelectionReturn {
    selectedDateKey: string;
    /** 실제 오늘(KST) — 마운트 후 갱신된다. */
    todayKey: string;
    selectDate: (dateKey: string) => void;
}

/**
 * 사용자가 날짜를 눌렀을 때 그날 상세 패널로 화면을 옮긴다. `block: 'nearest'`라 이미 보이면
 * 움직이지 않는다. `typeof` 가드는 `scrollIntoView`가 없는 환경(jsdom)에서 effect가 죽지 않게 한다.
 */
function scrollPanelIntoView(dateKey: string): void {
    const panel = document.getElementById(`panel-${dateKey}`);
    if (panel === null || typeof panel.scrollIntoView !== 'function') return;
    const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false;
    panel.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
}

/**
 * - `todayKey`는 서버 `today`로 시작해 마운트 후 실제 시각으로 갱신한다 — ISR 페이지는 최대
 *   하루 묵어 있을 수 있다. 렌더 중 `new Date()`는 하이드레이션을 깨므로 effect에서만 읽는다.
 * - 기본 선택일은 **갱신된 `todayKey`** 기준으로 다시 고른다 — 묵은 `today`로 고르면 오늘 링과
 *   열린 패널이 서로 다른 날을 가리킨다.
 * - 스크롤은 사용자가 직접 누른 선택에만 반응한다(기본 선택으로 페이지가 튀지 않게). 클릭마다
 *   새 객체라 같은 날짜를 다시 눌러도 다시 돈다. 패널의 `hidden`이 풀린 커밋 **뒤**에 옮겨야
 *   하고, 백그라운드 탭에서 멈추는 rAF는 쓰지 않는다.
 *
 * useEffectEvent + startTransition은 react-hooks/set-state-in-effect를 만족시키는 기존 패턴이다.
 */
export function useCalendarSelection({
    groups,
    today,
    activeImpacts,
}: UseCalendarSelectionInput): UseCalendarSelectionReturn {
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const [userSelection, setUserSelection] = useState<{
        dateKey: string;
    } | null>(null);
    const [todayKey, setTodayKey] = useState(today);

    const syncDefault = useEffectEvent((): void => {
        startTransition(() => {
            setSelectedDateKey(
                pickDefaultDateKey(groups, todayKey, activeImpacts)
            );
        });
    });
    const syncToday = useEffectEvent((): void => {
        startTransition(() => {
            setTodayKey(kstDateKey(new Date()));
        });
    });

    useEffect(() => {
        syncDefault();
    }, [groups, todayKey]);

    useEffect(() => {
        syncToday();
    }, [today]);

    useEffect(() => {
        if (userSelection === null) return;
        scrollPanelIntoView(userSelection.dateKey);
    }, [userSelection]);

    const selectDate = (dateKey: string): void => {
        setSelectedDateKey(dateKey);
        setUserSelection({ dateKey });
    };

    return { selectedDateKey, todayKey, selectDate };
}
