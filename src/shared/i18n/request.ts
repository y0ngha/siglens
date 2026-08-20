import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { loadMessages } from './loadMessages';

/**
 * 요청별 next-intl 설정.
 *
 * `requestLocale`은 `[locale]` 세그먼트에서 온다. 검증에 실패하면 던지지 않고
 * 기본 로케일로 떨어뜨린다 — 던지면 `/xx/AAPL` 같은 잘못된 접두사가 500이 되는데,
 * 봇에게 5xx를 주는 것은 404보다 나쁘다(크롤 예산이 깎이고 색인이 흔들린다).
 *
 * `timeZone`은 KST로 고정한다. 서버 기본 시간대를 쓰면 배포 환경에 따라 SSR과
 * 클라이언트 렌더의 날짜가 달라져 hydration이 깨진다. 시장 시각(ET) 표기는
 * `shared/lib/eastern.ts`가 따로 책임지므로 이 설정과 충돌하지 않는다.
 */
export default getRequestConfig(async ({ requestLocale }) => {
    // `requestLocale`은 next-intl 4.13에서 deprecated이고 대체제인 `next/root-params`는
    // Next 16.3+ 기능이다. 이 레포는 16.2.12에 고정돼 있고(커스텀 cache-handler 계약과
    // yarn patch가 걸려 있어 Next 업그레이드는 별도 PR이어야 한다) 그때까지 이 경로를 쓴다.
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;

    return {
        locale,
        messages: await loadMessages(locale),
        timeZone: 'Asia/Seoul',
        getMessageFallback: ({ key, namespace }) =>
            namespace ? `${namespace}.${key}` : key,
        onError: error => {
            // 키 패리티는 CI의 `yarn i18n:verify`가 막지만, 그건 **정적으로 보이는
            // 키**만 본다. 변수로 조립되는 키가 빠지면 게이트를 통과한 채 화면에만
            // 키 문자열이 뜬다. 통째로 침묵시키면 그 신호가 영원히 사라지므로
            // 서버 로그에는 남긴다(클라이언트 콘솔은 채우지 않는다).
            if (typeof window === 'undefined') {
                console.error('[i18n]', error.message);
            }
        },
    };
});
