import type { ExtremeFearGreedZone, SignalType } from '@y0ngha/siglens-core';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';

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
    | 'settings';

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
