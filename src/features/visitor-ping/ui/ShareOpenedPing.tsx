'use client';

import { useEffect } from 'react';
import type { ShareableKind } from '@/shared/db/constants';
import { sendOnHumanInteraction } from '@/shared/lib/beacon';
import { claimShareOpened } from '@/shared/lib/funnel/shareMarks';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

interface ShareOpenedPingProps {
    readonly id: string;
    readonly kind: ShareableKind;
}

/**
 * 공유 링크 페이지를 연 사람이 한 명 늘었다는 `share_opened`를 보낸다. 분석의 종류만 싣고 종목·id·URL은
 * 싣지 않는다.
 *
 * 서버가 아니라 클라이언트에서, 그것도 첫 신뢰 입력 뒤에 보내는 이유: 카카오톡·X·슬랙의 링크 미리보기
 * 수집기가 공유 URL을 요청하므로 서버에서 세면 열람이 부풀려진다. 입력을 만들지 않는 수집기와
 * 헤드리스는 여기서 걸러진다(`sendOnHumanInteraction`).
 *
 * 이 브라우저가 만든 링크를 연 경우(자기 열람)와 오늘 이미 연 링크는 세지 않는다(`claimShareOpened`).
 * 만료·없는 링크는 페이지가 404라 이 컴포넌트에 닿지 않는다.
 */
export function ShareOpenedPing({ id, kind }: ShareOpenedPingProps): null {
    useEffect(
        () =>
            sendOnHumanInteraction(() => {
                if (claimShareOpened(id)) {
                    trackFunnelEvent('share_opened', { shareKind: kind });
                }
            }),
        [id, kind]
    );
    return null;
}
