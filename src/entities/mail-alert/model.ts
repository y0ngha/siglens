import type {
    ExtremeFearGreedZone,
    SignalType,
    Trend,
} from '@y0ngha/siglens-core';
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
      }
    | MailAlertChangeItem;

/**
 * 종목의 달라진 점 하나(코어가 두 종가 사이를 읽은 결과를 메일이 말하는 모양으로 옮긴 것). 가격은 그 분석이 만든
 * 값 그대로이고, `analyzedAt`은 그 값을 낸 시그렌즈 AI 분석의 시각(ISO)이다 — 줄마다 근거 날짜를 적는다(CS-18).
 * 추세는 두 종가의 판정만 말한다(분석이 보여 준 추세와 무관한 계산값).
 */
export type MailAlertChange =
    | {
          readonly kind: 'trend';
          readonly from: Trend;
          readonly to: Trend;
      }
    | {
          readonly kind: 'level';
          readonly side: 'support' | 'resistance';
          /** `down`: 종가가 선의 아래쪽(지지선은 이하)으로, `up`: 위쪽(저항선은 이상)으로 옮겨 갔다. */
          readonly direction: 'down' | 'up';
          readonly price: number;
          readonly close: number;
          readonly analyzedAt: string;
      }
    | {
          readonly kind: 'plan_zone';
          readonly position: 'in_zone' | 'above_zone' | 'below_zone';
          readonly low: number;
          readonly high: number;
          readonly close: number;
          readonly analyzedAt: string;
      }
    | {
          readonly kind: 'plan_stopped';
          readonly stop: number;
          readonly close: number;
          readonly analyzedAt: string;
      };

/** "담은 종목에서 달라진 점"의 한 줄: 추세, 지지·저항선, 진입 구간·무효화 기준의 변화. */
export interface MailAlertChangeItem {
    readonly kind: 'change';
    readonly section: 'mine';
    readonly market: SignalHistoryMarket;
    readonly symbol: string;
    readonly name: string | null;
    /** 그 종가의 세션 날짜(`YYYY-MM-DD`). */
    readonly sessionDate: string;
    readonly change: MailAlertChange;
}

/** 메일에 실리는 신호 줄. */
export type MailAlertSignalItem = Extract<MailAlertItem, { kind: 'signal' }>;

/** "담은 종목" 섹션의 줄: 새 신호 아니면 달라진 점. */
export type MailAlertMineItem = MailAlertSignalItem | MailAlertChangeItem;

/** 메일에 실리는 공포·탐욕 극단 구간 진입 줄. */
export type MailAlertFearGreedItem = Extract<
    MailAlertItem,
    { kind: 'fear_greed' }
>;

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
    /** 살아 있는 가격대 알림(진행 중, 만료 세션을 판정하는 실행 전까지). 공개 전이면 비어 있다. */
    readonly priceAlerts: readonly PriceAlertView[];
    /** 알린 지 얼마 안 된 가격대 알림(보존 기간 안, 최근 순). */
    readonly firedPriceAlerts: readonly PriceAlertView[];
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
    /** 만료 세션: 그 시장에서 마지막으로 종가를 판정하는 세션의 날짜(한국 날짜가 아니다). */
    readonly expiresOn: string;
    readonly status: PriceAlertRecord['status'];
    readonly firedSession: string | null;
    readonly firedClose: number | null;
    /** 알림 메일을 선점한 시각(DB 시계). 알리지 않은 알림은 null. */
    readonly firedAt: Date | null;
}

/** 분할 등으로 가격 기준이 달라져 끝낸 가격대 알림을 알리는 줄. */
export interface MailAlertVoidedPriceAlertItem {
    readonly kind: 'price_alert_voided';
    readonly alertId: string;
    readonly symbol: string;
}

/** 메일에 실리는 가격대 알림 줄. 조건을 충족한 첫 종가와 그 세션을 함께 든다. */
export interface MailAlertPriceAlertItem {
    readonly kind: 'price_alert';
    readonly alertId: string;
    readonly symbol: string;
    readonly market: PriceAlertRecord['market'];
    readonly condition: PriceAlertCondition;
    readonly basis: PriceAlertBasis;
    readonly analysisAt: Date | null;
    readonly referenceClose: number;
    readonly createdAt: Date;
    /** 조건을 처음 충족한 종가의 세션(`YYYY-MM-DD`)과 그 종가. */
    readonly firedSession: string;
    readonly firedClose: number;
    /**
     * 구간 알림에서 그 종가가 구간의 어디에 있는지(코어 판정 그대로). 구간 안이면 `inside`, 구간을 건너뛰어
     * 아래·위에서 마감했으면 `below`·`above`. 구간이 아닌 알림은 `null`.
     */
    readonly zonePosition: 'inside' | 'below' | 'above' | null;
}

/**
 * 시그렌즈 AI 대화가 만든 가격대 알림 제안. 서명된 토큰이 담는 값이자 카드가 그리는 값이다. 서버가 쓰는 곳은
 * 한 곳(`proposePriceAlert` 도구)이고, 만들기 버튼이 누르는 액션이 서명·만료·소유자를 확인한 뒤에야 DB에 쓴다.
 * 모델이 쓴 자유 문구는 담지 않는다 — 가격은 분석·시세·사용자가 말한 숫자에서만 온다.
 */
export interface PriceAlertProposal {
    /** 같은 제안을 두 번 눌러도 알림이 하나만 생기게 하는 id(`price_alerts.proposal_id`). */
    readonly proposalId: string;
    /** 제안을 받은 호출자의 서명된 해시. 다른 브라우저로 복사한 토큰이 아무것도 만들지 못하게 한다. */
    readonly subject: string;
    readonly symbol: string;
    readonly market: PriceAlertRecord['market'];
    readonly condition: PriceAlertCondition;
    readonly basis: PriceAlertBasis;
    /** 가격대가 나온 AI 분석의 `analyzedAt`(ISO). 직접 말한 가격이면 null. */
    readonly analysisAt: string | null;
    /**
     * `startsAfterSession` 세션의 종가(장중이면 전일 종가). 발송기의 분할 판정이 지금 읽은 일봉의 그 세션 종가와 견주는
     * 값이라 장중 시세가 아니라 마감 종가여야 한다 — 하루 +70% 같은 등락이 분할로 오인되지 않는다.
     */
    readonly referenceClose: number;
    /** 알림을 제안할 때 읽은 시세의 시각(ISO). 공급자가 시각을 주지 않으면 null. */
    readonly quoteAt: string | null;
    /** 만들 때 마지막으로 마감된 세션(`YYYY-MM-DD`). 그 뒤 종가만 판정한다. */
    readonly startsAfterSession: string;
    /** 종가를 판정하는 마지막 세션(`YYYY-MM-DD`). */
    readonly expiresOn: string;
    /** 제안이 만료되는 시각(unix 초). */
    readonly exp: number;
}

/** 만든 알림에 실제로 저장된 조건과 마지막 판정 세션(`YYYY-MM-DD`). */
export interface PriceAlertStoredTerms {
    readonly condition: PriceAlertCondition;
    readonly expiresOn: string;
}

/**
 * 만든 알림을 어디서 관리하는지. `member`는 siglens.io에 로그인한 회원이라 알림 메일 설정 화면이 알아본다. `guest`는 쿠키가
 * ai 호스트에만 있어 siglens.io에서는 알아볼 수 없으므로 메일 속 설정 링크로 관리한다.
 */
export type PriceAlertOwnerKind = 'member' | 'guest';

/**
 * 카드가 열릴 때의 상태. `ready`는 누르면 만들 수 있다는 뜻이고 `mode`가 어떻게 만드는지 가른다:
 * `member`(이메일이 인증된 회원) · `known`(같은 브라우저에서 이미 신청한 주소) · `new`(코드로 주소를 확인해야 한다).
 */
export type PriceAlertProposalState =
    | {
          readonly status: 'ready';
          readonly mode: 'member' | 'known';
          readonly maskedEmail: string;
      }
    | {
          readonly status: 'ready';
          readonly mode: 'new';
          /** 이메일 인증 전 회원이면 계정 주소 — 입력 칸에 채워 고정한다. */
          readonly accountEmail: string | null;
      }
    | {
          readonly status: 'created';
          readonly maskedEmail: string;
          readonly owner: PriceAlertOwnerKind;
          /** 저장된 알림의 값. 만든 시각에 다시 계산되므로 제안과 다를 수 있어, 카드는 이 값을 보인다. */
          readonly stored: PriceAlertStoredTerms;
      }
    | {
          readonly status:
              | 'exists'
              | 'limit_reached'
              | 'proposal_expired'
              | 'proposal_stale'
              | 'already_met'
              | 'invalid'
              | 'unavailable';
      };

/** 만들기 버튼 결과. `needs_code`는 이 브라우저에 확인된 주소가 없다는 뜻이라 코드 확인부터 해야 한다. */
export type PriceAlertCreateResult =
    | {
          readonly status: 'created';
          readonly maskedEmail: string;
          readonly owner: PriceAlertOwnerKind;
          /** 저장된 알림의 값. 만든 시각에 다시 계산되므로 제안과 다를 수 있어, 카드는 이 값을 보인다. */
          readonly stored: PriceAlertStoredTerms;
      }
    | {
          readonly status:
              | 'exists'
              | 'limit_reached'
              | 'needs_code'
              | 'rate_limited'
              | 'proposal_expired'
              /** 제안 뒤 세션이 마감돼 가격을 다시 읽어야 하는데 읽지 못했다 — 다시 요청해 달라고 안내한다. */
              | 'proposal_stale'
              /** 제안 뒤 세션이 마감됐고 새 시세가 이미 조건을 충족한다 — 알림을 만들지 않았다. */
              | 'already_met'
              | 'invalid'
              | 'unavailable';
      };

/** 코드 확인과 알림 만들기를 한 번에 하는 비회원 흐름의 결과. 코드 오류는 `MailAlertConfirmState`와 같은 이름이다. */
export type PriceAlertConfirmState =
    | { readonly status: 'idle' }
    | {
          readonly status: 'created';
          readonly maskedEmail: string;
          readonly owner: PriceAlertOwnerKind;
          /** 저장된 알림의 값. 만든 시각에 다시 계산되므로 제안과 다를 수 있어, 카드는 이 값을 보인다. */
          readonly stored: PriceAlertStoredTerms;
      }
    | {
          readonly status:
              | 'exists'
              | 'wrong_code'
              | 'expired'
              | 'too_many'
              | 'rate_limited'
              | 'limit_reached'
              | 'proposal_expired'
              | 'proposal_stale'
              | 'already_met'
              | 'invalid'
              | 'invalid_email'
              | 'unavailable';
      };
