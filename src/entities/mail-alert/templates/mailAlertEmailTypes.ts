import type { Locale } from '@/shared/i18n/locales';
import type { MailAlertPlan } from '../lib/planMailAlertItems';

/**
 * `entities.mail-alert.email` 네임스페이스 번역자. 템플릿은 순수 함수라 요청 스코프가 없다 — 발송 cron이
 * 구독자 로케일로 `getTranslations({ locale, namespace })`를 만들어 넘긴다.
 */
export type MailAlertEmailTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/** 신호 유형 → 사람이 읽는 라벨(`shared.enumLabel.signalType`). 사전에 없으면 `null`. */
export type MailAlertSignalLabelResolver = (type: string) => string | null;

export interface BuildMailAlertEmailInput {
    readonly to: string;
    readonly locale: Locale;
    /** 알림 날짜(KST, `YYYY-MM-DD`). 제목의 날짜다. */
    readonly alertDate: string;
    readonly plan: MailAlertPlan;
    readonly siteUrl: string;
    /** 서명된 설정 링크. */
    readonly manageUrl: string;
    /** 서명된 설정 링크 + 수신거부 구역(`#unsubscribe`). */
    readonly unsubscribePageUrl: string;
    /** `List-Unsubscribe`가 가리키는 원클릭 POST 엔드포인트. */
    readonly unsubscribeApiUrl: string;
    /** 투자 면책 고지 문장(`shared.legal.investmentDisclaimer`). */
    readonly disclaimer: string;
    /** 같은 구독자·같은 알림 날짜는 같은 키 — 겹친 시도가 두 통이 되지 않게 제공자가 거른다. */
    readonly idempotencyKey: string;
    readonly t: MailAlertEmailTranslator;
    readonly signalLabel: MailAlertSignalLabelResolver;
}
