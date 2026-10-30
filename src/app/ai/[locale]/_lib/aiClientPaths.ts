import { CHROME_CLIENT_PATHS } from '@/shared/i18n/clientNamespaces';

/**
 * ai 호스트 레이아웃이 `NextIntlClientProvider`로 내려보내는 클라이언트 next-intl 네임스페이스.
 *
 * `layout.tsx`는 프레임워크 필드 외 export가 빌드 오류라 별도 모듈이다.
 * `CHROME_CLIENT_PATHS`를 포함하는 이유: ai 호스트도 메인과 같은 `Header` 위젯 트리
 * (`AuthSessionHeaderClient`)를 그려 같은 메시지 키(내비 라벨·검색·테마·로케일 전환·로그아웃)가
 * 필요하다. 이 집합은 생성기(`yarn i18n:extract`)가 관리하고 `clientKeyCoverage.test.ts`가
 * 이 컴포넌트 트리에 대해 충분함을 증명한다. 일부만 손으로 고르면 헤더 의존성이 동적 키
 * 네임스페이스(`shared.config.nav` 등 — 정적 `useTranslations('literal')` 스캔에 안 잡힌다)를
 * 쓰는 순간 조용히 어긋난다.
 *
 * 비용(측정): 로케일당 클라이언트 메시지가 `messages/ko.json` 기준 `pickMessages`로
 * ~3.6KB에서 ~16.6KB로 늘었다. 헤더를 둘로 나눠 어긋나게 두는 대신 하나를 공유하는 값이고,
 * ai 호스트는 ISR/SEO 표면이 없어 과도하게 넓은 네임스페이스로 first-load JS가 커졌던
 * 문제(`shared/i18n/loadMessages.ts`)가 같은 방식으로 적용되지 않는다.
 */
export const AI_CLIENT_PATHS: readonly string[] = [
    ...CHROME_CLIENT_PATHS,
    'widgets.agent-chat',
    'features.agent-chat',
    'features.pwa-install',
    'app.ai',
];
