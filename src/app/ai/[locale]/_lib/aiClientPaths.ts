import { CHAT_CHANGE_SIGNAL_TYPES } from '@/entities/chat-conversation/lib/chatChangeSignalTypes';
import { CHROME_CLIENT_PATHS } from '@/shared/i18n/clientNamespaces';

/** 신호 유형 이름 카탈로그(`shared.enumLabel.signalType.<type>`)의 네임스페이스. */
const SIGNAL_TYPE_LABEL_NAMESPACE = 'shared.enumLabel.signalType';

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
 *
 * 답변 안 차트의 세 네임스페이스는 `messages/ko.json` 기준 로케일당 약 8.2KB(`widgets.chart` 2.3KB,
 * `shared.ui.misc` 0.8KB, `shared.skillName` 5.1KB)를 더한다. 차트 코드는 지연 청크지만 메시지는 레이아웃이 한 번에
 * 내려보내므로 모든 ai 페이지에 실린다 — 차트가 처음 그려질 때 메시지가 없어 키가 그대로 보이는 것보다 낫다고 봤다.
 */
export const AI_CLIENT_PATHS: readonly string[] = [
    ...CHROME_CLIENT_PATHS,
    'widgets.agent-chat',
    'features.agent-chat',
    // 답변 아래 가격대 알림 카드의 이메일·코드 단계(`MailAlertEmailStep`·`MailAlertCodeStep`)가 쓰는 문구. 카드가 처음
    // 나올 때만 쓰이지만 메시지는 레이아웃이 한 번에 내려보낸다.
    'features.mail-alert',
    // 답변 아래 👍/👎(MessageActions)와 그 입력창.
    'features.ai-feedback',
    'features.pwa-install',
    'app.ai',
    // 답변 안 차트(`ChatChart` → `StockChart`)의 메뉴·범례·작도 라벨과 스킬 표시명.
    'widgets.chart',
    'shared.ui.misc',
    'shared.skillName',
    // 답변 안 시각화 블록이 재사용하는 시그렌즈 위젯의 문구 — 네임스페이스 통째가 아니라 쓰는 하위 경로만 싣는다
    // (`ChatVisualBlock`: 재무 추세 차트·표, 옵션 미결제약정 차트와 그 툴팁, 수급 분기 막대). 어긋나면 키가 그대로 보이므로
    // `ChatVisualBlock.dom-fast.test`가 이 경로만 담은 메시지로 렌더해 확인한다.
    'widgets.financials.StatementTable',
    'widgets.financials.section.tableScrollHint',
    'widgets.options.OpenInterestChart',
    'widgets.options.tooltip.openInterest',
    'widgets.options.tooltip.callOpenInterest',
    'widgets.options.tooltip.putOpenInterest',
    'widgets.investor-flows.flowChart',
    'shared.ui.InfoTooltip',
    // 다시 연 대화의 "달라진 점" 카드(`SinceEarlierCard`)가 쓰는 공용 추세 이름과, 카드가 푸는 신호(`CHAT_CHANGE_SIGNAL_TYPES`)의
    // 이름만 — 네임스페이스 통째가 아니라 쓰는 키만 싣는다(측정: 로케일당 약 0.3~0.4KB, ko 355바이트). 신호 목록에서
    // 만들어, 카드가 푸는 신호가 늘면 이름도 함께 실린다.
    'shared.enumLabel.trend',
    ...CHAT_CHANGE_SIGNAL_TYPES.map(
        type => `${SIGNAL_TYPE_LABEL_NAMESPACE}.${type}`
    ),
];
