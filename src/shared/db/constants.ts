import type { Tier } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';

/** user `tier` 컬럼의 enum 값. `satisfies`로 core의 `Tier` 유니온과 어긋나면 컴파일이 실패하게 묶는다. */
export const USER_TIER_VALUES = [
    'free',
    'member',
    'pro',
] as const satisfies readonly Tier[];

/** `oauth_provider` Postgres enum values. `kakao`는 레거시 값이다 — `OAuthProvider` 주석 참고. */
export const OAUTH_PROVIDER_VALUES = [
    'google',
    'kakao',
    'apple',
] as const satisfies readonly OAuthProvider[];

/** `terms` 테이블이 구분하는 약관 문서 종류. */
export const TERMS_KIND_VALUES = ['privacy', 'tos'] as const;
export type TermsKind = (typeof TERMS_KIND_VALUES)[number];

/**
 * 메일 리포트 수신을 마지막으로 켠 화면. `email_report_subscriptions.consent_source` 컬럼의 허용 값이며
 * (마이그레이션 CHECK와 같다), 정책 문서의 "수신에 동의한 화면"과 짝이다.
 */
export const EMAIL_REPORT_CONSENT_SOURCE_VALUES = [
    'settings',
    'signup_email',
    'signup_oauth',
] as const;
export type EmailReportConsentSource =
    (typeof EMAIL_REPORT_CONSENT_SOURCE_VALUES)[number];

/**
 * 알림 메일 신청 화면(`mail_alert_subscribers.consent_source`)의 허용 값 — 마이그레이션 CHECK와 같다.
 * `schema.ts`는 entities를 import할 수 없어 여기에 두고, 이 값들이 `entities/mail-alert/model.ts`의
 * 유니온과 같은지는 `src/shared/db/__tests__/mailAlertSchema.test.ts`가 고정한다.
 */
export const MAIL_ALERT_CONSENT_SOURCE_VALUES = [
    'symbol',
    'fear_greed',
    'signal_hub',
    'settings',
    'agent_chat',
] as const;
export type MailAlertConsentSourceValue =
    (typeof MAIL_ALERT_CONSENT_SOURCE_VALUES)[number];

/** `mail_alert_topics.kind`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const MAIL_ALERT_TOPIC_KIND_VALUES = [
    'symbol',
    'signal',
    'fear_greed',
] as const;
export type MailAlertTopicKindValue =
    (typeof MAIL_ALERT_TOPIC_KIND_VALUES)[number];

/** `mail_alert_deliveries.status`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const MAIL_ALERT_DELIVERY_STATUS_VALUES = [
    'pending',
    'sent',
    'failed',
] as const;

/** `price_alerts.market`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const PRICE_ALERT_MARKET_VALUES = ['us', 'kr'] as const;
export type PriceAlertMarketValue = (typeof PRICE_ALERT_MARKET_VALUES)[number];

/** `price_alerts.condition`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const PRICE_ALERT_CONDITION_VALUES = [
    'enter_zone',
    'close_below',
    'close_above',
] as const;
export type PriceAlertConditionValue =
    (typeof PRICE_ALERT_CONDITION_VALUES)[number];

/** `price_alerts.approach`의 허용 값(구간 알림에만 쓴다) — 마이그레이션 CHECK와 같다. */
export const PRICE_ALERT_APPROACH_VALUES = [
    'from_above',
    'from_below',
] as const;
export type PriceAlertApproachValue =
    (typeof PRICE_ALERT_APPROACH_VALUES)[number];

/** `price_alerts.basis`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const PRICE_ALERT_BASIS_VALUES = [
    'analysis_entry_zone',
    'analysis_invalidation',
    'price_level',
] as const;
export type PriceAlertBasisValue = (typeof PRICE_ALERT_BASIS_VALUES)[number];

/** `price_alerts.status`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const PRICE_ALERT_STATUS_VALUES = ['active', 'fired'] as const;
export type PriceAlertStatusValue = (typeof PRICE_ALERT_STATUS_VALUES)[number];

/** `signal_scan_cursors.last_outcome`의 허용 값 — 마이그레이션 CHECK와 같다. */
export const SIGNAL_SCAN_OUTCOME_VALUES = [
    'recorded',
    'failed',
    'stale',
] as const;
export type SignalScanOutcome = (typeof SIGNAL_SCAN_OUTCOME_VALUES)[number];

/** 공유 가능한 분석 종류 — Postgres enum이자 UI 판별자로 함께 쓴다. */
export const SHAREABLE_KIND_VALUES = [
    'chart',
    'overall',
    'news',
    'fundamental',
    'financials',
    'congress',
    'options',
    'fear-greed',
] as const;
export type ShareableKind = (typeof SHAREABLE_KIND_VALUES)[number];

/** 종목 심볼 컬럼(`varchar`)의 길이. 스키마와 입력 검증기가 같은 값을 쓰도록 여기서 내보낸다. */
export const SYMBOL_MAX_LENGTH = 32;
