import 'server-only';

import { priceLevelStart, type PriceLevelTarget } from '@y0ngha/siglens-core';
import type {
    CreatePriceAlertInput,
    MailAlertOwner,
    PriceAlertRepository,
} from '@/shared/db/types';
import {
    PRICE_ALERT_MAX_ACTIVE,
    PRICE_ALERT_RATE_LIMIT,
} from '../lib/priceAlertConstants';
import { maskEmail } from '../lib/maskEmail';
import {
    priceAlertExpiresOn,
    priceAlertStartsAfterSession,
} from '../lib/priceAlertExpiry';
import type {
    PriceAlertConfirmState,
    PriceAlertCreateResult,
    PriceAlertOwnerKind,
    PriceAlertProposal,
    PriceAlertProposalState,
    PriceAlertStoredTerms,
} from '../model';
import { confirmMailAlertCode } from './mailAlertCode';
import { isPriceAlertProposalExpired } from './priceAlertProposalToken';
import type { PriceAlertReference } from './priceAlertReference';
import {
    forgetStaleCookie,
    isEnabled,
    linkSessionMember,
    ownerOf,
    resolveCaller,
    upsertVerifiedOnce,
    type MailAlertFlowDeps,
} from './mailAlertFlows';

/**
 * 알림 메일 흐름의 의존성에 제안 토큰과 만들기를 더한다. 공개 스위치는 알림 메일 흐름의 `priceAlertsEnabled`
 * (`isPriceAlertLaunched()`)를 같이 쓴다: 꺼져 있으면 모든 흐름이 `unavailable`이다.
 */
export interface PriceAlertFlowDeps extends Omit<
    MailAlertFlowDeps,
    'priceAlerts'
> {
    readonly priceAlerts: MailAlertFlowDeps['priceAlerts'] &
        Pick<
            PriceAlertRepository,
            'createWithinLimit' | 'findByProposal' | 'countActive'
        >;
    /** 토큰을 검증해 제안으로 돌려준다(서명·모양). 아니면 `null`. */
    readonly verifyProposal: (token: unknown) => PriceAlertProposal | null;
    /**
     * 지금 호출자의 서명된 해시 — 세션 회원이면 회원 id, 아니면 비회원 쿠키 id로 만든다. 알아볼 수 없으면 `null`이라
     * 제안은 아무것도 만들지 못한다.
     */
    readonly callerSubject: () => Promise<string | null>;
    /**
     * 제안 뒤 세션이 마감됐을 때 지금 시세와 새 기준 세션의 종가를 다시 읽는다. 못 읽으면 `null`.
     */
    readonly readReference: (
        proposal: PriceAlertProposal,
        startsAfterSession: string,
        now: Date
    ) => Promise<PriceAlertReference | null>;
    readonly now: () => number;
}

type ProposalCheck =
    | {
          readonly ok: true;
          readonly proposal: PriceAlertProposal;
          /** `allowExpired`로 읽었을 때만 참일 수 있다 — 만료된 제안을 흘려보내지 않고 호출자가 판단하게 한다. */
          readonly expired: boolean;
      }
    | { readonly ok: false; readonly status: 'proposal_expired' | 'invalid' };

/**
 * 토큰의 서명·만료·소유자를 확인한다. 서명이 틀렸거나 소유자가 다른 토큰(다른 브라우저로 복사한 것)은 `invalid`다: 이 토큰으로는
 * 누구도 알림을 만들 수 없고, 만료 여부도 알려 주지 않는다. 다만 사용자에게는 만료와 같은 안내("다시 요청해 주세요")가 맞다 —
 * 에이전트에게 다시 부탁하면 지금 브라우저에 묶인 새 제안이 나와 풀리기 때문이다. 만료는 기본적으로 거절이지만 이미 만든
 * 알림을 되돌려 주는 읽기(상태, 같은 토큰의 재시도)는 `allowExpired`로 만료된 제안도 받는다.
 */
async function checkProposal(
    deps: PriceAlertFlowDeps,
    token: unknown,
    allowExpired = false
): Promise<ProposalCheck> {
    const proposal = deps.verifyProposal(token);
    if (proposal === null) return { ok: false, status: 'invalid' };
    const expired = isPriceAlertProposalExpired(proposal, deps.now());
    if (expired && !allowExpired) {
        return { ok: false, status: 'proposal_expired' };
    }
    const subject = await deps.callerSubject();
    if (subject === null || subject !== proposal.subject) {
        return { ok: false, status: 'invalid' };
    }
    return { ok: true, proposal, expired };
}

function toTarget(
    condition: PriceAlertProposal['condition']
): PriceLevelTarget {
    return condition.kind === 'enter_zone'
        ? { kind: 'zone', low: condition.low, high: condition.high }
        : {
              kind: condition.kind === 'close_below' ? 'below' : 'above',
              level: condition.level,
          };
}

type CreatePlan =
    | { readonly ok: true; readonly input: CreatePriceAlertInput }
    | {
          readonly ok: false;
          readonly status: 'already_met' | 'proposal_stale';
      };

/**
 * 저장할 값을 **만드는 시각** 기준으로 정한다. 기준 세션(`startsAfterSession`)과 마지막 판정 세션(`expiresOn`)은 만드는
 * 순간의 마감 세션으로 다시 계산한다 — 제안 때의 값을 그대로 쓰면, 24시간 유효한 제안을 늦게 누른 사이에 마감된 세션의
 * 종가가 "만들기 전 종가"인데도 판정 구간에 들어가 알림이 만든 직후 울릴 수 있다.
 *
 * 제안 뒤 세션이 하나라도 마감됐으면 제안 때의 시세 판정(이미 충족인지)과 기준 종가가 낡았으므로 시세를 다시 읽어
 * `priceLevelStart`를 다시 돈다. 이미 충족이면 알림을 만들지 않고(`already_met`), 시세를 못 읽거나 판정할 수 없으면
 * 만들지 않고 다시 요청해 달라고 알린다(`proposal_stale`). 마감된 세션이 없으면 제안의 값이 그대로 유효하다.
 */
async function planCreate(
    deps: PriceAlertFlowDeps,
    proposal: PriceAlertProposal
): Promise<CreatePlan> {
    const now = new Date(deps.now());
    const startsAfterSession = [
        proposal.startsAfterSession,
        priceAlertStartsAfterSession(proposal.market, now),
    ].reduce((latest, session) => (session > latest ? session : latest));
    const common = {
        proposalId: proposal.proposalId,
        symbol: proposal.symbol,
        market: proposal.market,
        basis: proposal.basis,
        analysisAt:
            proposal.analysisAt === null ? null : new Date(proposal.analysisAt),
        startsAfterSession,
        expiresOn: priceAlertExpiresOn(proposal.market, now),
    };
    if (startsAfterSession === proposal.startsAfterSession) {
        return {
            ok: true,
            input: {
                ...common,
                condition: proposal.condition,
                referenceClose: proposal.referenceClose,
            },
        };
    }
    const reference = await deps.readReference(
        proposal,
        startsAfterSession,
        now
    );
    if (reference === null) return { ok: false, status: 'proposal_stale' };
    const start = priceLevelStart(
        reference.price,
        toTarget(proposal.condition)
    );
    if (!start.ok) {
        return {
            ok: false,
            status:
                start.reason === 'invalid' ? 'proposal_stale' : 'already_met',
        };
    }
    return {
        ok: true,
        input: {
            ...common,
            condition: start.condition,
            referenceClose: reference.referenceClose,
        },
    };
}

/** 이 제안으로 이미 만들어진 알림의 저장된 값(같은 제안의 재시도·더블클릭·새로 고침). 없으면 `null`. */
async function storedFor(
    deps: PriceAlertFlowDeps,
    owner: MailAlertOwner,
    proposalId: string
): Promise<PriceAlertStoredTerms | null> {
    const record = await deps.priceAlerts.findByProposal(owner, proposalId);
    return record === null
        ? null
        : { condition: record.condition, expiresOn: record.expiresOn };
}

/**
 * 카드가 열릴 때의 상태. 읽기 전용이라 한도도 쓰지 않는다. 같은 제안으로 이미 만든 알림이 있으면 `created`
 * (새로 고침하거나 하루 뒤에 대화를 다시 열어도 "만들었어요"가 남는다), 만료된 제안은 만들 수 없으니 `proposal_expired`,
 * 살아 있는 알림이 상한이면 `limit_reached`, 아니면 `ready`다.
 */
export async function getPriceAlertProposalState(
    deps: PriceAlertFlowDeps,
    token: unknown
): Promise<PriceAlertProposalState> {
    if (!isEnabled(deps) || !deps.priceAlertsEnabled) {
        return { status: 'unavailable' };
    }
    const checked = await checkProposal(deps, token, true);
    if (!checked.ok) return { status: checked.status };
    const state = await stateForCaller(deps, checked.proposal);
    return checked.expired && state.status !== 'created'
        ? { status: 'proposal_expired' }
        : state;
}

/** 호출자(알아볼 수 없음·인증 전 회원·인증된 회원·쿠키가 있는 비회원)에 따른 제안의 상태. 만료는 보지 않는다. */
async function stateForCaller(
    deps: PriceAlertFlowDeps,
    proposal: PriceAlertProposal
): Promise<PriceAlertProposalState> {
    const caller = await resolveCaller(deps, undefined);
    if (caller.kind === 'anonymous') {
        return { status: 'ready', mode: 'new', accountEmail: null };
    }
    if (caller.kind === 'unverified') {
        return {
            status: 'ready',
            mode: 'new',
            accountEmail: caller.user.email,
        };
    }
    const owner = await ownerOf(deps, caller);
    if (owner === null) {
        return { status: 'ready', mode: 'new', accountEmail: null };
    }
    if (caller.kind === 'member') {
        const row = await deps.subscribers.findForMember(caller.user.id);
        const maskedEmail = maskEmail(caller.user.email);
        const stored =
            row === null
                ? null
                : await storedFor(deps, owner, proposal.proposalId);
        if (stored !== null) {
            return { status: 'created', maskedEmail, owner: 'member', stored };
        }
        if (
            row !== null &&
            (await deps.priceAlerts.countActive(owner)) >=
                PRICE_ALERT_MAX_ACTIVE
        ) {
            return { status: 'limit_reached' };
        }
        return { status: 'ready', mode: 'member', maskedEmail };
    }
    const row = await deps.subscribers.findByOwner(owner);
    if (row === null) {
        await forgetStaleCookie(deps, caller);
        return { status: 'ready', mode: 'new', accountEmail: null };
    }
    const maskedEmail = maskEmail(row.email);
    const stored = await storedFor(deps, owner, proposal.proposalId);
    if (stored !== null) {
        return { status: 'created', maskedEmail, owner: 'guest', stored };
    }
    if ((await deps.priceAlerts.countActive(owner)) >= PRICE_ALERT_MAX_ACTIVE) {
        return { status: 'limit_reached' };
    }
    return { status: 'ready', mode: 'known', maskedEmail };
}

/** 저장소가 정한 결과만 담은 사용자 결과 — 만들기 버튼과 코드 확인 흐름이 같이 쓴다. */
type CreateOutcomeResult =
    | {
          readonly status: 'created';
          readonly maskedEmail: string;
          readonly owner: PriceAlertOwnerKind;
          readonly stored: PriceAlertStoredTerms;
      }
    | { readonly status: 'exists' | 'limit_reached' | 'invalid' };

type CreateOutcome = Awaited<
    ReturnType<PriceAlertRepository['createWithinLimit']>
>;

/**
 * 저장소 결과를 사용자 결과로 옮긴다. 같은 제안 id(`exists`)는 멱등한 성공이라 `created`다 — 두 번 눌러도,
 * 다시 열어도 "만들었어요"이고, 다른 제안이 같은 가격대의 살아 있는 알림과 겹칠 때(`duplicate`)만 `exists`다.
 */
async function toCreateResult(
    deps: PriceAlertFlowDeps,
    owner: MailAlertOwner,
    input: CreatePriceAlertInput,
    outcome: CreateOutcome,
    maskedEmail: string,
    ownerKind: PriceAlertOwnerKind
): Promise<CreateOutcomeResult | 'subscriber_missing'> {
    switch (outcome) {
        case 'created':
        case 'exists': {
            // 카드에는 저장된 값을 보인다 — 재시도(`exists`)는 처음 만든 값이고, 제안과 다를 수 있다.
            const stored = (await storedFor(deps, owner, input.proposalId)) ?? {
                condition: input.condition,
                expiresOn: input.expiresOn,
            };
            return { status: 'created', maskedEmail, owner: ownerKind, stored };
        }
        case 'duplicate':
            return { status: 'exists' };
        case 'limit_reached':
            return { status: 'limit_reached' };
        case 'invalid':
            return { status: 'invalid' };
        case 'subscriber_missing':
            return 'subscriber_missing';
    }
}

/**
 * 이 제안으로 이미 만든 알림이 있으면 그 저장된 값으로 `created` 결과를 만든다. 같은 토큰의 재시도(응답을 잃음, 다른 탭,
 * 세션이 마감된 뒤, 만료된 뒤)가 새 시세·만료·한도 검사에 막혀 "만들 수 없어요"로 바뀌지 않게 하려고 그런 검사보다 먼저 부른다.
 * 서명과 소유자 확인(`checkProposal`)을 마친 뒤여야 하고, 읽기는 호출자의 소유자 조건 안에서만 한다(남의 알림을 읽지 않는다).
 */
async function existingCreated(
    deps: PriceAlertFlowDeps,
    proposal: PriceAlertProposal
): Promise<Extract<PriceAlertCreateResult, { status: 'created' }> | null> {
    const caller = await resolveCaller(deps, undefined);
    if (caller.kind !== 'member' && caller.kind !== 'guest') return null;
    const owner = await ownerOf(deps, caller);
    if (owner === null) return null;
    const stored = await storedFor(deps, owner, proposal.proposalId);
    if (stored === null) return null;
    const email =
        caller.kind === 'member'
            ? caller.user.email
            : ((await deps.subscribers.findByOwner(owner))?.email ?? '');
    return {
        status: 'created',
        maskedEmail: maskEmail(email),
        owner: caller.kind === 'member' ? 'member' : 'guest',
        stored,
    };
}

async function withinCreateRateLimit(
    deps: PriceAlertFlowDeps
): Promise<boolean> {
    return deps.rateLimit({
        key: `price-alert:create:ip:${await deps.ipHash()}`,
        ...PRICE_ALERT_RATE_LIMIT.createPerIp,
    });
}

/**
 * 만들기 버튼. 서명·만료·소유자를 확인한 뒤 호출자의 구독자 행에 알림을 만든다: 이메일이 인증된 회원은 코드
 * 없이(구독자 행이 없으면 계정 주소로 만든다), 같은 브라우저에서 이미 신청한 비회원은 쿠키가 가리키는 행에
 * 만든다. 둘 다 아니면 `needs_code` — 코드로 주소를 확인하는 흐름(`confirmPriceAlertFlow`)으로 넘어간다.
 */
export async function createPriceAlertFlow(
    deps: PriceAlertFlowDeps,
    token: unknown
): Promise<PriceAlertCreateResult> {
    if (!isEnabled(deps) || !deps.priceAlertsEnabled) {
        return { status: 'unavailable' };
    }
    const checked = await checkProposal(deps, token, true);
    if (!checked.ok) return { status: checked.status };
    const existing = await existingCreated(deps, checked.proposal);
    if (existing !== null) return existing;
    if (checked.expired) return { status: 'proposal_expired' };
    // 한도는 시세를 다시 읽기(`planCreate`) 전에 본다 — 막힌 요청이 공급자 호출을 일으키지 않게. 같은 제안의 재시도는
    // 위의 `existingCreated`가 먼저 돌려주므로 한도를 쓰지 않는다.
    if (!(await withinCreateRateLimit(deps))) {
        return { status: 'rate_limited' };
    }
    const plan = await planCreate(deps, checked.proposal);
    if (!plan.ok) return { status: plan.status };

    const caller = await resolveCaller(deps, undefined);
    if (caller.kind !== 'member' && caller.kind !== 'guest') {
        return { status: 'needs_code' };
    }
    if (caller.kind === 'member') {
        const existing = await deps.subscribers.findForMember(caller.user.id);
        if (existing === null) {
            await upsertVerifiedOnce(deps, caller.user.email, 'agent_chat');
        }
    }
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'needs_code' };
    const maskedEmail =
        caller.kind === 'member'
            ? maskEmail(caller.user.email)
            : maskEmail(
                  (await deps.subscribers.findByOwner(owner))?.email ?? ''
              );
    const result = await toCreateResult(
        deps,
        owner,
        plan.input,
        await deps.priceAlerts.createWithinLimit(
            owner,
            plan.input,
            PRICE_ALERT_MAX_ACTIVE
        ),
        maskedEmail,
        caller.kind === 'member' ? 'member' : 'guest'
    );
    if (result !== 'subscriber_missing') return result;
    await forgetStaleCookie(deps, caller);
    return { status: 'needs_code' };
}

/**
 * 비회원(또는 이메일 인증 전 회원)의 코드 확인과 알림 만들기. 제안을 먼저 확인해 코드를 쓰지 않고 거절하고,
 * 코드를 확인하면 구독자 행(동의한 화면 `agent_chat`)을 만들거나 다시 확인한 뒤 알림을 만든다. 주소로 연결할
 * 인증된 회원이 있으면 행이 그 회원에게 붙으므로 그 회원 소유자로 다시 만든다(`confirmMailAlertFlow`와 같다).
 */
export async function confirmPriceAlertFlow(
    deps: PriceAlertFlowDeps,
    input: {
        readonly email: string;
        readonly code: string;
        readonly token: unknown;
    }
): Promise<PriceAlertConfirmState> {
    if (
        !isEnabled(deps) ||
        !deps.priceAlertsEnabled ||
        deps.emailTokens === null
    ) {
        return { status: 'unavailable' };
    }
    const checked = await checkProposal(deps, input.token, true);
    if (!checked.ok) return { status: checked.status };
    const existing = await existingCreated(deps, checked.proposal);
    if (existing !== null) return existing;
    if (checked.expired) return { status: 'proposal_expired' };
    // 한도는 시세를 다시 읽기(`planCreate`) 전에 본다 — 막힌 요청이 공급자 호출을 일으키지 않게.
    if (!(await withinCreateRateLimit(deps))) {
        return { status: 'rate_limited' };
    }
    // 코드를 쓰기 전에 정한다 — 시세를 못 읽어 거절하는 요청이 코드를 태우지 않게.
    const plan = await planCreate(deps, checked.proposal);
    if (!plan.ok) return { status: plan.status };
    const outcome = await confirmMailAlertCode(input.email, input.code, {
        emailTokens: deps.emailTokens,
        rateLimit: deps.rateLimit,
        ipHash: await deps.ipHash(),
    });
    if (outcome.status !== 'verified') return { status: outcome.status };

    const { id } = await upsertVerifiedOnce(deps, outcome.email, 'agent_chat');
    await linkSessionMember(deps, outcome.email, id);
    const maskedEmail = maskEmail(outcome.email);
    const createInput = plan.input;
    // 알림 메일 설정 화면이 알아보는 것은 siglens.io에 로그인한 인증 회원뿐이다. 그 밖에는 메일 속 링크로 관리한다.
    const session = await deps.currentUser();
    const ownerKind: PriceAlertOwnerKind =
        session !== null && session.emailVerified ? 'member' : 'guest';
    const guestOwner: MailAlertOwner = { kind: 'guest', subscriberId: id };
    const asGuest = await toCreateResult(
        deps,
        guestOwner,
        createInput,
        await deps.priceAlerts.createWithinLimit(
            guestOwner,
            createInput,
            PRICE_ALERT_MAX_ACTIVE
        ),
        maskedEmail,
        ownerKind
    );
    if (asGuest !== 'subscriber_missing') {
        // 행이 이 비회원의 것이라는 확인은 끝났다 — 알림이 상한에 걸려도 다음엔 코드를 다시 묻지 않는다.
        await deps.guestCookie.write(id);
        return asGuest;
    }
    const member = await deps.users.findByEmail(outcome.email);
    if (member === null) return { status: 'unavailable' };
    const memberOwner: MailAlertOwner = { kind: 'member', userId: member.id };
    const asMember = await toCreateResult(
        deps,
        memberOwner,
        createInput,
        await deps.priceAlerts.createWithinLimit(
            memberOwner,
            createInput,
            PRICE_ALERT_MAX_ACTIVE
        ),
        maskedEmail,
        ownerKind
    );
    return asMember === 'subscriber_missing'
        ? { status: 'unavailable' }
        : asMember;
}
