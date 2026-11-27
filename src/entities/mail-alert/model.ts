import type { ExtremeFearGreedZone, SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import type {
    PriceAlertConditionRecord,
    PriceAlertRecord,
} from '@/shared/db/types';

/** 공포·탐욕 알림을 받을 수 있는 시장. 크립토 지수는 있지만 크립토 종목은 v1에서 알리지 않는다. */
export type MailAlertFearGreedMarket = 'us' | 'kr' | 'crypto';

/** 받을 항목 하나. 화면마다 자기 대상만 구독한다. */
export type MailAlertTopic =
    /** 대문자 정규형(관심종목과 같다). 미국·한국 주식과 ETF. */
    | { readonly kind: 'symbol'; readonly symbol: string }
    /** 신호별 종목 페이지가 여는 신호 유형 중 하나(`MAIL_ALERT_SIGNAL_TYPES`). */
    | { readonly kind: 'signal'; readonly signalType: SignalType }
    | {
          readonly kind: 'fear_greed';
          readonly market: MailAlertFearGreedMarket;
      };

/** 처음 신청한 화면. `mail_alert_subscribers.consent_source`의 허용 값과 같다. */
export type MailAlertConsentSource =
    | 'symbol'
    | 'fear_greed'
    | 'signal_hub'
    | 'settings'
    /** 시그렌즈 AI 대화에서 만든 가격대 알림. */
    | 'agent_chat';

/** 메일 한 통에 실리는 항목. `section`은 "담은 종목"(mine)과 "신호별 새 종목"(hub)을 가른다. */
export type MailAlertItem =
    | {
          readonly kind: 'signal';
          readonly section: 'mine' | 'hub';
          readonly market: SignalHistoryMarket;
          readonly symbol: string;
          readonly name: string | null;
          readonly signalType: SignalType;
          readonly sessionDate: string;
          readonly changePercent: number | null;
      }
    | {
          readonly kind: 'fear_greed';
          readonly market: MailAlertFearGreedMarket;
          readonly zone: ExtremeFearGreedZone;
          readonly date: string;
          readonly score: number;
      };

/**
 * 대화상자가 열릴 때 서버가 알려 주는 이 화면 항목의 상태. 주소는 가린 모양(`maskEmail`)만 내려간다.
 *
 * - `new`: 코드로 주소를 확인해야 한다. 이메일 인증 전 회원이면 `accountEmail`이 채워져 그 주소를 고정해 보여 준다.
 * - `member`: 이메일이 인증된 회원 — 코드 없이 받을 수 있다. `includePortfolio`는 지금 켜져 있는지.
 * - `known`: 같은 브라우저에서 이미 신청한 주소(서명된 쿠키)로 이 항목만 더한다.
 * - `subscribed`: 이 항목은 이미 받고 있다.
 */
export type MailAlertState =
    | { readonly status: 'unavailable' }
    | { readonly status: 'new'; readonly accountEmail: string | null }
    | {
          readonly status: 'member';
          readonly maskedEmail: string;
          readonly includePortfolio: boolean;
      }
    | { readonly status: 'known'; readonly maskedEmail: string }
    | { readonly status: 'subscribed'; readonly maskedEmail: string };

/** 코드 요청(1단계) 결과. `invalid_email`만 형식 오류이고, 주소·계정 존재 여부는 어느 상태에도 드러나지 않는다. */
export type MailAlertRequestCodeState =
    | { readonly status: 'idle' }
    | { readonly status: 'code_sent'; readonly email: string }
    | { readonly status: 'invalid_email' }
    | { readonly status: 'rate_limited' }
    | { readonly status: 'unavailable' };

/** 코드 확인(2단계) 결과. */
export type MailAlertConfirmState =
    | { readonly status: 'idle' }
    | { readonly status: 'subscribed'; readonly maskedEmail: string }
    | {
          readonly status:
              | 'wrong_code'
              | 'expired'
              | 'too_many'
              | 'rate_limited'
              | 'limit_reached'
              | 'invalid'
              | 'unavailable';
      };

/** 항목 추가·보유 종목 함께 받기 같은 변경 결과. `needs_code`는 코드 확인부터 해야 한다는 뜻이다. */
export type MailAlertAddResult =
    | { readonly status: 'subscribed'; readonly maskedEmail: string }
    | {
          readonly status:
              | 'needs_code'
              | 'limit_reached'
              | 'rate_limited'
              | 'invalid'
              | 'unavailable';
      };

/** 항목 하나 제거, 모두 그만 받기, 보유 종목 스위치 결과. */
export interface MailAlertChangeResult {
    readonly status:
        | 'ok'
        | 'subscriber_removed'
        | 'not_found'
        | 'invalid'
        | 'unavailable';
}

/** 메일 속 링크가 싣는 서명된 구독자 id. 없으면 세션이나 쿠키로 소유자를 정한다. */
export interface MailAlertLinkAuth {
    readonly s: string;
    readonly sig: string;
}

/** 설정 화면이 그리는 구독자의 현재 항목. */
export interface MailAlertManageView {
    readonly maskedEmail: string;
    readonly topics: readonly MailAlertTopic[];
    /** 회원일 때만 스위치가 의미 있다. */
    readonly includePortfolio: boolean | null;
}

/** 가격대 알림이 읽는 가격의 출처. DB `price_alerts.basis`의 허용 값과 같다. */
export type PriceAlertBasis =
    | 'analysis_entry_zone'
    | 'analysis_invalidation'
    | 'price_level';

/**
 * 알림 조건의 DB 모양. core의 `PriceLevelCondition`과 같은 세 모양이지만 `shared/db`가 core를 import하지
 * 않으려고 저장 계층 타입을 그대로 쓴다(이름 하나로 두 계층이 같은 모양을 본다).
 */
export type PriceAlertCondition = PriceAlertConditionRecord;

/** 화면과 메일이 그리는 가격대 알림 한 건. */
export interface PriceAlertView {
    readonly id: string;
    readonly symbol: string;
    readonly market: PriceAlertRecord['market'];
    readonly condition: PriceAlertCondition;
    readonly basis: PriceAlertBasis;
    /** 기준이 된 AI 분석 시각. 가격을 직접 말한 알림은 null. */
    readonly analysisAt: Date | null;
    readonly referenceClose: number;
    readonly createdAt: Date;
    /** 한국 날짜. 이 날까지 유지된다. */
    readonly expiresOn: string;
    readonly status: PriceAlertRecord['status'];
    readonly firedSession: string | null;
    readonly firedClose: number | null;
}
