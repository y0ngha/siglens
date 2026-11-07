'use client';

import { useEffect, useRef } from 'react';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { postBeacon, sendOnHumanInteraction } from '@/shared/lib/beacon';

/**
 * 마지막으로 비콘을 보낸 `${KST 날짜}:${member|guest}`를 담는다. 날짜만 담던 이전 키
 * `siglens:visit`은 읽지 않는다 — 다음 방문에 한 번 더 보낼 뿐이고 서버가 흡수한다.
 */
const STORAGE_KEY = 'siglens:visit:v2';

/** 마지막 전송 마커. 사파리 프라이빗 모드 등으로 못 읽으면 `null` — 매번 보내고 서버가 중복을 흡수한다. */
function readLastMarker(): string | null {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/** 첫 진입 출처 신호. 서버가 정해진 분류값으로 바꾸고 원본은 버린다(`entrySourceOf`). */
interface EntryOrigin {
    referrerHost: string | null;
    utmSource: string | null;
}

/**
 * 이 문서를 처음 연 순간의 Referer 호스트와 `utm_source`. 경로·쿼리 전체는 보내지 않는다 —
 * 호스트 이름과 `utm_source` 값만 떼어 낸다.
 */
function readEntryOrigin(): EntryOrigin {
    const referrerHost = URL.canParse(document.referrer)
        ? new URL(document.referrer).hostname || null
        : null;
    const utmSource =
        new URLSearchParams(window.location.search).get('utm_source') || null;
    return { referrerHost, utmSource };
}

function sendPresence(isMember: boolean, origin: EntryOrigin): void {
    // 신원을 마커에 넣는 이유: 비회원으로 보낸 날 가입·로그인하면 같은 날 마커가 남아 서버의
    // `COALESCE(user_id, excluded.user_id)` 채움이 영영 돌지 않는다. 신원이 바뀐 첫 방문에
    // 한 번 더 보내면 서버가 같은 (방문자, 날짜) 행에 user_id만 채운다.
    const today = `${kstDateKey(new Date())}:${isMember ? 'member' : 'guest'}`;
    if (readLastMarker() === today) return;

    const hasOrigin = origin.referrerHost !== null || origin.utmSource !== null;
    postBeacon({
        url: '/api/presence',
        ...(hasOrigin && { body: origin }),
        onDelivered: () => window.localStorage.setItem(STORAGE_KEY, today),
    });
}

/**
 * 하루 한 번, 방문 사실과 첫 진입 출처를 알린다. IP와 User-Agent는 이미 요청 헤더에 있어
 * 본문에는 출처 신호(Referer 호스트·`utm_source`)만 싣고, 둘 다 없으면 본문 없이 보낸다.
 *
 * 출처는 **마운트 시점에 한 번** 읽어 둔다(`originRef`). 루트 레이아웃에 붙어 클라이언트
 * 내비게이션에도 남아 있으므로, 첫 입력이 다른 페이지로 옮긴 뒤에 와도 처음 연 문서의
 * Referer·쿼리를 보낸다 — 그 뒤의 `location`은 사이트 안의 페이지다.
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
 * 전송은 첫 신뢰 입력 뒤에만 한다(`sendOnHumanInteraction`). 렌더만 하고 떠나는
 * 헤드리스는 JS를 실행해도 입력을 만들지 않으므로 여기서 걸러진다.
 */
export function VisitorPing(): null {
    const isMember = useAuthHint();
    const originRef = useRef<EntryOrigin | null>(null);
    useEffect(() => {
        // `??=`는 React Compiler가 지원하지 않는다(react-hooks-js/todo).
        if (originRef.current === null) originRef.current = readEntryOrigin();
        const origin = originRef.current;
        return sendOnHumanInteraction(() => sendPresence(isMember, origin));
    }, [isMember]);

    return null;
}
