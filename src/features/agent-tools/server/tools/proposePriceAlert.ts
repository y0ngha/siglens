import 'server-only';
import {
    alertablePlanLevels,
    priceLevelStart,
    type ActionRecommendation,
    type PriceLevelCondition,
    type PriceLevelTarget,
} from '@y0ngha/siglens-core';
import { isChatPriceAlertProposalBlock } from '@/entities/chat-conversation/lib/chartBlock';
import type { ChatPriceAlertProposalBlock } from '@/entities/chat-conversation/types';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { DrizzlePriceAlertRepository } from '@/entities/mail-alert/api';
import {
    PRICE_ALERT_LEVEL_BAND,
    PRICE_ALERT_MAX_ACTIVE,
    PRICE_ALERT_PROPOSAL_TTL_SECONDS,
} from '@/entities/mail-alert/lib/priceAlertConstants';
import {
    isPriceAlertLive,
    priceAlertAsOf,
    priceAlertExpiresOn,
    priceAlertStartsAfterSession,
} from '@/entities/mail-alert/lib/priceAlertExpiry';
import type {
    PriceAlertBasis,
    PriceAlertProposal,
} from '@/entities/mail-alert/model';
import {
    priceAlertSubject,
    signPriceAlertProposal,
} from '@/entities/mail-alert/server/priceAlertProposalToken';
import { readPriceAlertReference } from '@/entities/mail-alert/server/priceAlertReference';
import { staleKrListingDate } from '@/entities/ticker/lib/freshness';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveAssetInfoOrNull } from '@/entities/ticker/server/resolveAssetInfo';
import type { ToolExecutor } from '@/features/agent-tools/model';
import { MS_PER_SECOND } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { PriceAlertRecord } from '@/shared/db/types';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { isGuestSubject } from '@/shared/lib/guestSubject';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import type { AssetInfo } from '@/shared/lib/types';
import { peekTechnicalCacheHit } from './getCachedAnalysis';

const TOOL = 'propose_price_alert';

/** 모델이 고르는 기준. 분석 기준은 서버가 분석에서 읽고, 가격 기준은 사용자가 말한 숫자다. */
const BASES = [
    'analysis_entry_zone',
    'analysis_invalidation',
    'price_below',
    'price_above',
] as const;
type RequestedBasis = (typeof BASES)[number];

const isBasis = (value: unknown): value is RequestedBasis =>
    BASES.some(basis => basis === value);

const DAILY = '1Day';

/** 알림 기준(저장·메일·카드가 보는 값)으로 옮긴다. */
const STORED_BASIS: Record<RequestedBasis, PriceAlertBasis> = {
    analysis_entry_zone: 'analysis_entry_zone',
    analysis_invalidation: 'analysis_invalidation',
    price_below: 'price_level',
    price_above: 'price_level',
};

type TargetOutcome =
    | {
          readonly ok: true;
          readonly target: PriceLevelTarget;
          readonly analysisAt: string | null;
      }
    | { readonly ok: false; readonly error: string };

/**
 * 분석 기준의 가격대를 `get_cached_analysis`와 **같은 peek**에서 읽는다. 숫자는 모델이 아니라 저장된 분석에서만
 * 온다. 이 호출자 티어에 계획이 잠겨 있으면(`actionRecommendation`이 `null`) 숫자 없이 `levels_locked`다.
 */
async function analysisTarget(
    basis: 'analysis_entry_zone' | 'analysis_invalidation',
    symbol: string,
    fmpSymbol: string | undefined,
    ctx: Parameters<ToolExecutor>[1],
    runtime: Parameters<ToolExecutor>[2]
): Promise<TargetOutcome> {
    const hit = await peekTechnicalCacheHit(
        symbol,
        DAILY,
        fmpSymbol,
        ctx,
        runtime
    );
    if (hit === null) return { ok: false, error: 'no_analysis' };
    const { analyzedAt, actionRecommendation } = hit.cached.result;
    if (analyzedAt === undefined) return { ok: false, error: 'no_analysis' };
    if (actionRecommendation === null || actionRecommendation === undefined) {
        return { ok: false, error: 'levels_locked' };
    }
    // 티어 필터가 산문 필드만 비우므로 가격대 필드는 `ActionRecommendation`으로 읽어도 된다(`getCachedAnalysis`의 sinceAnalysis와 같은 해석).
    const levels = alertablePlanLevels(
        actionRecommendation as ActionRecommendation
    );
    if (basis === 'analysis_entry_zone') {
        return levels.entryZone === null
            ? { ok: false, error: 'no_level' }
            : {
                  ok: true,
                  target: { kind: 'zone', ...levels.entryZone },
                  analysisAt: analyzedAt,
              };
    }
    return levels.invalidation === null
        ? { ok: false, error: 'no_level' }
        : {
              ok: true,
              target: { kind: 'below', level: levels.invalidation },
              analysisAt: analyzedAt,
          };
}

function priceTarget(
    basis: 'price_below' | 'price_above',
    price: number,
    currentPrice: number
): TargetOutcome {
    const withinBand =
        price >= currentPrice * PRICE_ALERT_LEVEL_BAND.min &&
        price <= currentPrice * PRICE_ALERT_LEVEL_BAND.max;
    if (!withinBand) return { ok: false, error: 'out_of_range' };
    return {
        ok: true,
        target: {
            kind: basis === 'price_below' ? 'below' : 'above',
            level: price,
        },
        analysisAt: null,
    };
}

function sameLevels(
    a: PriceLevelCondition,
    b: PriceAlertRecord['condition']
): boolean {
    if (a.kind !== b.kind) return false;
    const six = (value: number) => value.toFixed(6);
    if (a.kind === 'enter_zone' && b.kind === 'enter_zone') {
        return (
            a.approach === b.approach &&
            six(a.low) === six(b.low) &&
            six(a.high) === six(b.high)
        );
    }
    return (
        a.kind !== 'enter_zone' &&
        b.kind !== 'enter_zone' &&
        six(a.level) === six(b.level)
    );
}

/**
 * 회원의 살아 있는 알림 상한·같은 가격대 알림을 미리 알려 준다(만들기 버튼이 눌리기 전에 모델이 "이미 있어요"라고 말할 수
 * 있게). 읽기 전용이며 회원만 본다 — 비회원의 구독자 행은 서명된 쿠키가 가리키는데 도구 실행에는 그 쿠키가 없어,
 * 비회원의 상한과 중복은 만들기 버튼이 확정한다. 읽기 실패는 제안을 막지 않는다(버튼이 같은 검사를 다시 한다).
 */
async function softRefusal(
    userId: string,
    symbol: string,
    condition: PriceLevelCondition,
    now: Date
): Promise<'limit_reached' | 'exists' | null> {
    if (isGuestSubject(userId)) return null;
    try {
        const repo = new DrizzlePriceAlertRepository(getDatabaseClient().db);
        const owner = { kind: 'member', userId } as const;
        const alerts = await repo.listForSubscriber(owner);
        // 살아 있는 알림만 센다: 진행 중이면서 만료 세션이 그 시장의 기대 세션 이상(발송기와 같은 규칙).
        const asOf = priceAlertAsOf(now);
        const live = alerts.filter(
            alert => alert.status === 'active' && isPriceAlertLive(alert, asOf)
        );
        if (
            live.some(
                alert =>
                    alert.symbol === symbol &&
                    sameLevels(condition, alert.condition)
            )
        ) {
            return 'exists';
        }
        return live.length >= PRICE_ALERT_MAX_ACTIVE ? 'limit_reached' : null;
    } catch (error) {
        logToolDegrade(TOOL, 'soft limit check', error);
        return null;
    }
}

function conditionFields(condition: PriceLevelCondition) {
    return condition.kind === 'enter_zone'
        ? {
              condition: condition.kind,
              low: condition.low,
              high: condition.high,
          }
        : { condition: condition.kind, level: condition.level };
}

/** 무엇이 알림을 울리는지 — 코어 규칙 그대로(경계 포함)를 모델이 한 줄로 옮길 수 있게 건넨다. */
function firesWhen(condition: PriceLevelCondition): string {
    if (condition.kind === 'enter_zone') {
        return condition.approach === 'from_above'
            ? 'a daily close at or below the top of the zone (it reaches the zone or passes below it)'
            : 'a daily close at or above the bottom of the zone (it reaches the zone or passes above it)';
    }
    return condition.kind === 'close_below'
        ? 'a daily close at or below the level'
        : 'a daily close at or above the level';
}

/** 카드에 보일 종목명: 기본 로케일(한국어)은 한글 이름을 먼저, 그 밖에는 영문 이름. 종목을 못 읽었으면 `null`. */
function cardName(asset: AssetInfo | null, locale: string): string | null {
    if (asset === null) return null;
    if (locale === DEFAULT_LOCALE) return asset.koreanName ?? asset.name;
    return asset.name;
}

const NOT_CREATED_NOTE =
    'Nothing is created yet: the user creates it with the button under this answer. Tell them that in one sentence. Never say the alert is set.';

/**
 * `propose_price_alert` — 가격대 알림을 **제안만** 한다. DB·메일 어디에도 쓰지 않는다. 시세와 마지막 마감 종가를 읽고, 분석
 * 기준이면 저장된 분석에서 가격대를 읽어(`alertablePlanLevels`) 코어 규칙(`priceLevelStart`)으로 지금 가격이 이미
 * 그 자리에 있지 않은지 확인한 뒤, 서명된 제안을 카드 블록으로 `emitChart`에 넘긴다. 알림은 사용자가 카드의 버튼을
 * 눌러야 만들어진다(`createPriceAlertAction`). 절대 던지지 않는다 — 실패는 결과 코드다.
 */
export const proposePriceAlertTool: ToolExecutor = async (
    args,
    ctx,
    runtime
) => {
    const { symbol: rawSymbol, basis, price } = args;
    if (typeof rawSymbol !== 'string' || !isBasis(basis)) {
        return { error: 'invalid_args' };
    }
    const isPriceBasis = basis === 'price_below' || basis === 'price_above';
    // 분석 기준에서는 가격을 받지 않는다 — 모델이 분석 가격대를 직접 적어 넣는 길을 닫는다.
    if (
        isPriceBasis
            ? typeof price !== 'number' || !Number.isFinite(price) || price <= 0
            : price !== undefined
    ) {
        return { error: 'invalid_args' };
    }
    if (runtime.emitChart === undefined) return { error: 'unavailable' };
    const secret = readEmailReportSecret();
    if (secret === null) return { error: 'unavailable' };

    const symbol = rawSymbol.toUpperCase();
    const profile = await resolveMarketProfile(symbol);
    if (profile !== 'us-equity' && profile !== 'kr-equity') {
        return { error: 'unsupported_symbol' };
    }
    const market = profile === 'us-equity' ? 'us' : 'kr';
    const asset = await resolveAssetInfoOrNull(symbol, TOOL);
    const now = new Date();
    const startsAfterSession = priceAlertStartsAfterSession(market, now);
    // 시세(지금 가격)와 판정 기준이 되는 마지막 마감 세션의 종가를 함께 읽는다 — 발송기의 분할 판정이 그 종가와 견준다.
    const reference = await readPriceAlertReference({
        symbol,
        quoteSymbol: asset?.fmpSymbol ?? symbol,
        profile,
        startsAfterSession,
        now,
    });
    const quoteMs =
        reference?.quoteAt === null || reference === null
            ? undefined
            : Date.parse(reference.quoteAt);
    // 죽은 한국 리스팅(잘못된 접미사 등)의 낡은 시세는 기준 가격이 아니다.
    if (
        reference === null ||
        staleKrListingDate(profile, quoteMs, now.getTime()) !== null
    ) {
        return { error: 'quote_unavailable' };
    }
    // 지금 가격(시세)이 구간 밖 입력 검사와 이미 충족 판정의 기준이다.
    const currentPrice = reference.price;

    const target: TargetOutcome = isPriceBasis
        ? priceTarget(basis, price as number, currentPrice)
        : await analysisTarget(basis, symbol, asset?.fmpSymbol, ctx, runtime);
    if (!target.ok) return { error: target.error };

    const start = priceLevelStart(currentPrice, target.target);
    if (!start.ok) {
        // 이미 그 자리에 있거나 넘어선 가격이다. 가격대 숫자는 싣지 않는다(잠긴 계획과 같은 이유로, 사용자가 말한 가격만 되돌려도 충분하다).
        return start.reason === 'invalid'
            ? { error: 'no_level' }
            : { error: 'already_met', reason: start.reason, currentPrice };
    }
    const { condition } = start;

    const refusal = await softRefusal(ctx.userId, symbol, condition, now);
    if (refusal !== null) return { error: refusal };

    const proposal: PriceAlertProposal = {
        proposalId: crypto.randomUUID(),
        subject: priceAlertSubject(secret, ctx.userId),
        symbol,
        market,
        condition,
        basis: STORED_BASIS[basis],
        analysisAt: target.analysisAt,
        referenceClose: reference.referenceClose,
        quoteAt: reference.quoteAt,
        startsAfterSession,
        expiresOn: priceAlertExpiresOn(market, now),
        exp:
            Math.floor(now.getTime() / MS_PER_SECOND) +
            PRICE_ALERT_PROPOSAL_TTL_SECONDS,
    };
    const block: ChatPriceAlertProposalBlock = {
        version: 1,
        kind: 'price_alert_proposal',
        proposal,
        token: signPriceAlertProposal(secret, proposal),
        name: cardName(asset, ctx.locale),
    };
    // 클라이언트가 같은 가드로 못 그리는 카드는 내보내지 않는다 — 모델이 "아래 버튼"이라고 말하면 안 된다(SA-24).
    if (!isChatPriceAlertProposalBlock(block)) {
        logToolDegrade(TOOL, 'proposal block', new Error('invalid block'));
        return { error: 'unavailable' };
    }
    runtime.emitChart(Promise.resolve(block));
    return {
        status: 'proposed',
        symbol,
        ...conditionFields(condition),
        firesWhen: firesWhen(condition),
        basis: proposal.basis,
        analysisAt: proposal.analysisAt,
        currentPrice,
        lastClose: proposal.referenceClose,
        quoteAt: proposal.quoteAt,
        lastCheckedSession: proposal.expiresOn,
        requiresUserConfirmation: true,
        notes: [NOT_CREATED_NOTE],
    };
};
