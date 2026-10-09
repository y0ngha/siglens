'use client';

import { useEffect } from 'react';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { postBeacon, sendOnHumanInteraction } from '@/shared/lib/beacon';

/**
 * 마지막으로 비콘을 보낸 `${KST 날짜}:${member|guest}`를 담는다. 형식이 바뀌어 v2로 올렸다 —
 * 옛 `siglens:visit`(날짜만)은 읽지 않고 방치한다(다음 방문에 한 번 더 보낼 뿐, 서버가 흡수).
 */
const STORAGE_KEY = 'siglens:visit:v2';

function sendPresence(isMember: boolean): void {
    // 신원을 마커에 넣는 이유: 비회원으로 보낸 날 가입·로그인하면 같은 날 마커가 남아 서버의
    // `COALESCE(user_id, excluded.user_id)` 채움이 영영 돌지 않는다. 신원이 바뀐 첫 방문에
    // 한 번 더 보내면 서버가 같은 (방문자, 날짜) 행에 user_id만 채운다.
    const today = `${kstDateKey(new Date())}:${isMember ? 'member' : 'guest'}`;

    let last: string | null = null;
    try {
        last = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // 사파리 프라이빗 모드 등 — 매번 보낸다. 서버가 중복을 흡수한다.
    }
    if (last === today) return;

    postBeacon({
        url: '/api/presence',
        onDelivered: () => window.localStorage.setItem(STORAGE_KEY, today),
    });
}

/**
 * 하루 한 번, 방문 사실만 알린다. **본문은 보내지 않는다** — IP와 User-Agent는
 * 이미 요청 헤더에 있다.
 *
 * 서버가 아니라 클라이언트에서 보내는 이유가 두 가지다.
 *  1. 페이지에서 `headers()`를 부르면 그 라우트의 ISR이 꺼진다.
 *  2. JS를 실행하지 않는 크롤러는 이 비콘을 아예 띄우지 않는다 — UA 정규식보다
 *     강한 봇 필터가 공짜로 생긴다.
 *
 * 날짜는 `kstDateKey`로 판정한다. 브라우저 로컬 타임존을 쓰면 서버의 날짜 경계와
 * 어긋나 그 방문자가 특정 날에 통째로 누락된다. 반대 방향(중복 전송)은 서버가
 * `ON CONFLICT DO NOTHING`으로 흡수하므로 무해하다.
 *
 * 로그인 힌트 쿠키가 생기면(같은 날 로그인·가입) effect가 다시 돌아 신원 마커가 달라진 뒤
 * 한 번 더 보낸다. 서버 액션을 부르지 않으므로 비회원 비용은 없다.
 *
 * `@/entities/visitor/api`는 `server-only`라 여기서 import하지 않는다.
 *
 * 전송은 첫 신뢰 입력 뒤에만 한다(`onFirstInteraction`). 렌더만 하고 떠나는 헤드리스가
 * 이 필터를 통과하고 있었다.
 */
export function VisitorPing(): null {
    const isMember = useAuthHint();
    useEffect(
        () => sendOnHumanInteraction(() => sendPresence(isMember)),
        [isMember]
    );

    return null;
}
