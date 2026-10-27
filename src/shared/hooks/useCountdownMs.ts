'use client';

import { useEffect, useState } from 'react';
import { MS_PER_SECOND } from '@/shared/config/time';

/** `until`(epoch ms)까지 남은 시간. 지났거나 0이면 0. */
function remainingUntil(until: number): number {
    return Math.max(0, until - Date.now());
}

/**
 * `until`(epoch ms)까지 남은 시간을 1초마다 다시 계산해 돌려준다. 끝났거나 `until`이 0이면 0.
 *
 * 카운트다운은 **그 숫자를 보여 주는 컴포넌트 안에서** 돌게 한다. 상위 훅이 남은 ms를 state로 들고
 * 1초마다 깎으면, 버튼 문구 하나 때문에 그 훅을 쓰는 화면 전체가 매초 다시 렌더된다
 * (재분석 쿨다운이 종목 페이지 AI 패널 전체를 30초~5분 동안 매초 다시 그렸다).
 */
export function useCountdownMs(until: number): number {
    const [countdown, setCountdown] = useState(() => ({
        until,
        remaining: remainingUntil(until),
    }));

    // `until`이 바뀐 렌더에서 바로 맞춘다(렌더 중 조정, REACT.md#EF-1). effect로 미루면 바뀐 직후
    // 한 프레임 동안 이전 값(예: 0이라 눌리는 버튼)이 보인다.
    if (countdown.until !== until) {
        setCountdown({ until, remaining: remainingUntil(until) });
    }

    const remaining =
        countdown.until === until ? countdown.remaining : remainingUntil(until);
    // 시작 여부는 화면에 그린 값으로 정한다. effect 에서 시계를 다시 읽어 판단하면, 렌더와 effect 사이에
    // 끝난 경우 interval 이 시작되지 않아 몇 ms 남은 값이 그대로 남는다(버튼이 계속 막힘).
    const isCounting = remaining > 0;

    // 시계 구독: setState는 interval 콜백에서만 부른다.
    useEffect(() => {
        if (!isCounting) return;
        const intervalId = window.setInterval(() => {
            const left = remainingUntil(until);
            setCountdown({ until, remaining: left });
            if (left === 0) window.clearInterval(intervalId);
        }, MS_PER_SECOND);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [until, isCounting]);

    return remaining;
}
