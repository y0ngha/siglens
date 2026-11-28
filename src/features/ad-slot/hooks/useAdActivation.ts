'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    type AdTierDecision,
    resolveAdTier,
} from '@/features/ad-slot/lib/resolveAdTier';
import type { AdPlacementConfig } from '@/features/ad-slot/model/adPlacement';
import { sendOnHumanInteraction } from '@/shared/lib/beacon';

/**
 * 지연 자리를 미리 요청하는 거리. 화면 한 개 높이 앞에서 요청해야 사용자가 그 자리에 닿을 때
 * 광고가 이미 와 있다(늦게 뜨면 지나쳐 버려 가시성이 떨어진다).
 */
const LAZY_ROOT_MARGIN = '100% 0px';

export interface AdActivation {
    readonly tier: AdTierDecision;
    /** 광고를 요청해도 되는가. 사람 입력과 근접은 한 번 참이 되면 다시 내려가지 않는다. */
    readonly active: boolean;
}

/**
 * 광고 요청 시점을 정한다. 세 조건을 모두 만족해야 한다.
 *
 * 1. **사람 입력**(`sendOnHumanInteraction`): 자동화 브라우저는 영영 통과하지 않고, 나머지는 첫 신뢰
 *    입력 뒤에만 통과한다. 헤드리스 크롤·모니터링·프리웜의 노출은 무효 트래픽으로 공제되고, 많으면
 *    계정이 정지될 수 있어서 광고 스크립트조차 불러오지 않는다.
 * 2. **등급**(`resolveAdTier`): 로그인 정보가 확정되고 Pro가 아니어야 한다.
 * 3. **근접**(`lazy`만): 자리가 화면 한 개 높이 안으로 들어왔다.
 *
 * `box`는 ref 객체가 아니라 노드 자체를 받는다(콜백 ref로 상태에 담은 값). 상자는 등급이 `hide`면
 * 렌더되지 않으므로, ref 객체를 읽으면 나중에 상자가 생겨도 effect가 다시 돌지 않아 지연 자리가 영영
 * 활성화되지 않는다. 노드를 deps에 두면 상자가 생기는 순간 관찰을 시작한다.
 */
export function useAdActivation(
    box: HTMLElement | null,
    load: AdPlacementConfig['load']
): AdActivation {
    const { data: user, isPending } = useCurrentUser();
    const tier = resolveAdTier({ isPending, user });

    const [isHuman, setIsHuman] = useState(false);
    useEffect(() => sendOnHumanInteraction(() => setIsHuman(true)), []);

    const [isNear, setIsNear] = useState(load === 'eager');
    useEffect(() => {
        if (isNear || box === null) return;
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setIsNear(true);
                    observer.disconnect();
                }
            },
            { rootMargin: LAZY_ROOT_MARGIN }
        );
        observer.observe(box);
        return () => observer.disconnect();
    }, [isNear, box]);

    return { tier, active: isHuman && isNear && tier === 'show' };
}
