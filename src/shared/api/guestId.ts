import 'server-only';
import { cookies } from 'next/headers';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import { MS_PER_MINUTE } from '@/shared/config/time';
import {
    guestIdCookieOptions,
    signGuestId,
    verifyGuestCookie,
} from '@/shared/config/guestCookie';

/**
 * Reads the `siglens_guest` cookie without minting one. Used by routes that
 * must NOT be able to issue a guest id on their own (SIGLENS AI's chat stream
 * route — see `proxy.ts`'s `handleAiHost`, which mints the cookie on page
 * view instead) so that only a real browser page load can create a guest
 * identity. Returns `null` for an unsigned/legacy or forged value, same as a
 * missing cookie.
 */
export async function readGuestId(): Promise<string | null> {
    const store = await cookies();
    return verifyGuestCookie(store.get(GUEST_ID_COOKIE_NAME)?.value);
}

/** 서명 시크릿 누락 같은 설정 오류는 매 요청 반복되므로 분당 한 번만 남긴다. */
const MINT_ERROR_LOG_INTERVAL_MS = MS_PER_MINUTE;
let lastMintErrorAt = 0;

/**
 * 새 게스트 id를 서명해 **현재 응답**에 `siglens_guest` 쿠키로 심는다. 실패하면
 * 심지 않고 로그만 남긴다(던지지 않는다).
 *
 * `/api/analysis/stream` POST 응답 전용이다. {@link readGuestId}가 말하는 "라우트는
 * 스스로 발급하지 않는다"는 원칙은 ai 호스트 챗 스트림의 것이고, siglens.io에는
 * 이 쿠키를 발급하는 페이지 경로가 없다 — 페이지 응답에 `Set-Cookie`를 실으면 ISR·
 * CDN 캐시가 깨지므로 일부러 두지 않는다. 그래서 분석 한도의 개인 축이 쓸 id를
 * 분석 요청 응답에서 발급한다. 발급만으로 한도가 느슨해지지는 않는다 — 쿠키 없는
 * 요청은 IP 축으로만 세고, 쿠키는 다음 요청부터 개인 축에 쓰인다.
 *
 * 발급한 uuid를 돌려준다 — 하루 무료 공개 미터는 쿠키가 아직 안 돌아온 이번
 * 요청부터 이 id를 쓴다(생성 한도는 위 이유로 계속 쿠키 없는 신원으로 센다).
 * 발급에 실패하면 `null`이다(미터는 fail-closed로 잠금).
 *
 * 호스트 전용 쿠키다(`Domain` 없음). ai.siglens.io의 같은 이름 쿠키와 형식·서명이
 * 같지만 서로 섞이지 않는다(`GUEST_ID_COOKIE_NAME` JSDoc: 호스트별로 따로 발급).
 */
export async function mintGuestIdOnResponse(): Promise<string | null> {
    try {
        const store = await cookies();
        const guestId = crypto.randomUUID();
        store.set(
            GUEST_ID_COOKIE_NAME,
            await signGuestId(guestId),
            guestIdCookieOptions()
        );
        return guestId;
    } catch (error) {
        const now = Date.now();
        if (now - lastMintErrorAt >= MINT_ERROR_LOG_INTERVAL_MS) {
            lastMintErrorAt = now;
            console.error('[guestId] mint on response failed', error);
        }
        return null;
    }
}
