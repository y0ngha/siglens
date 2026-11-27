import 'server-only';

import type { EmailTokenStore } from '@/entities/email-token/types';
import type {
    MailAlertOwner,
    MailAlertSubscriberRepository,
    PriceAlertRecord,
    PriceAlertRepository,
    UserRepository,
} from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { isUniqueViolationError } from '../lib/dbErrorKind';
import {
    MAIL_ALERT_MAX_TOPICS,
    MAIL_ALERT_RATE_LIMITS,
} from '../lib/mailAlertConstants';
import { isPriceAlertLive, priceAlertAsOf } from '../lib/priceAlertExpiry';
import { maskEmail } from '../lib/maskEmail';
import { parseTopicInput, rowToTopic, topicToRow } from '../lib/topics';
import type {
    MailAlertAddResult,
    MailAlertChangeResult,
    MailAlertConfirmState,
    MailAlertConsentSource,
    MailAlertLinkAuth,
    MailAlertManageView,
    MailAlertRequestCodeState,
    MailAlertState,
    MailAlertTopic,
    PriceAlertView,
} from '../model';
import {
    confirmMailAlertCode,
    requestMailAlertCode,
    type MailAlertCodeDeps,
    type MailAlertRateLimiter,
} from './mailAlertCode';

/** 알림 id(`price_alerts.id`)의 모양. 아닌 값은 저장소까지 가지 않는다. */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 게스트 브라우저의 서명된 쿠키. `read`는 서명이 맞는 구독자 id만 돌려준다. */
export interface MailAlertGuestCookie {
    read(): Promise<string | null>;
    write(subscriberId: string): Promise<void>;
    clear(): Promise<void>;
}

export interface MailAlertFlowDeps {
    /** 공개 스위치(`isMailAlertLaunched`). 꺼져 있으면 모든 흐름이 `unavailable`이다. */
    readonly launched: boolean;
    /** 서명 비밀이 설정돼 있는지. 없으면 수신거부 링크가 안 되는 메일이 나가므로 신청을 받지 않는다. */
    readonly signingReady: boolean;
    readonly subscribers: Pick<
        MailAlertSubscriberRepository,
        | 'upsertVerified'
        | 'findByOwner'
        | 'findForMember'
        | 'listTopics'
        | 'addTopic'
        | 'removeTopic'
        | 'setIncludePortfolio'
        | 'deleteByOwner'
        | 'linkVerifiedMember'
    >;
    /** 설정 화면의 가격대 알림 목록과 지우기. 소유자 조건은 저장소가 문장 안에서 붙인다(DB-12). */
    readonly priceAlerts: Pick<
        PriceAlertRepository,
        'listForSubscriber' | 'cancel'
    >;
    /** 가격대 알림 공개 스위치(`isPriceAlertLaunched()`). 꺼져 있으면 목록은 비고 지우기는 `unavailable`이다. */
    readonly priceAlertsEnabled: boolean;
    readonly users: Pick<UserRepository, 'findByEmail'>;
    readonly currentUser: () => Promise<AuthUserRecord | null>;
    readonly guestCookie: MailAlertGuestCookie;
    /** 설정 링크의 서명(`alert-manage`) 검증. 이 값이 `link` 소유자의 유일한 권한이다. */
    readonly verifyLink: (link: MailAlertLinkAuth) => boolean;
    readonly rateLimit: MailAlertRateLimiter;
    /** 한도 카운터를 0으로 되돌린다(새 코드를 보낼 때 확인 시도 카운터). */
    readonly resetCounter: (key: string) => Promise<void>;
    readonly ipHash: () => Promise<string>;
    /** Redis 미설정이면 `null` — 코드를 저장할 곳이 없으니 신청을 받지 않는다. */
    readonly emailTokens: EmailTokenStore | null;
    readonly emailDispatcher: MailAlertCodeDeps['emailDispatcher'];
    readonly buildCodeMessage: MailAlertCodeDeps['buildMessage'];
    readonly locale: Locale;
}

/**
 * 읽기 전용 쿠키로 도는 흐름(RSC 렌더가 부르는 설정 화면 로더)의 의존성. 렌더 중에는 쿠키를 쓰거나 지울 수
 * 없으므로, 쿠키를 건드리는 `write`·`clear`는 타입에서 아예 빠진다. 낡은 쿠키는 액션이 다음에 지운다.
 */
export type MailAlertManageDeps = Omit<MailAlertFlowDeps, 'guestCookie'> & {
    readonly guestCookie: Pick<MailAlertGuestCookie, 'read'>;
};

/**
 * 호출자가 누구인지. **서명된 설정 링크가 있으면 링크가 먼저다**: 서명이 맞으면 그 링크가 가리키는
 * 구독자(`link`)가 소유자이고, 세션 회원의 구독으로 대신 움직이지 않는다. 링크가 있는데 서명이 틀리면
 * 아무도 알아보지 못한 것(`anonymous`)으로 거절한다 — 세션이나 쿠키로 조용히 넘어가지 않는다. 링크가 없을
 * 때만 세션 회원(이메일 인증됨) → 게스트 쿠키 순이다. 인증 전 회원은 아무것도 가져오지 못하고 코드로 주소를
 * 확인해야 하므로 따로 구분한다.
 */
export type Caller =
    | { readonly kind: 'link'; readonly subscriberId: string }
    | { readonly kind: 'member'; readonly user: AuthUserRecord }
    | { readonly kind: 'unverified'; readonly user: AuthUserRecord }
    | { readonly kind: 'guest'; readonly subscriberId: string }
    | { readonly kind: 'anonymous' };

export function isEnabled(
    deps: Pick<MailAlertFlowDeps, 'launched' | 'signingReady'>
): boolean {
    return deps.launched && deps.signingReady;
}

export async function resolveCaller(
    deps: MailAlertManageDeps,
    link: MailAlertLinkAuth | undefined
): Promise<Caller> {
    if (link !== undefined) {
        return deps.verifyLink(link)
            ? { kind: 'link', subscriberId: link.s }
            : { kind: 'anonymous' };
    }
    const user = await deps.currentUser();
    if (user !== null && user.emailVerified) return { kind: 'member', user };
    // 이메일 인증 전 회원이어도 `user_id`로 이미 연결된 행이 있으면 그 행의 주인이다: 연결은 같은 주소의
    // 코드 확인을 마친 뒤에만 생긴다(`linkVerifiedMember`). 조회는 `user_id = 내 id`를 문장 안에 담는다(DB-12).
    if (user !== null) {
        const linked = await deps.subscribers.findByOwner({
            kind: 'member',
            userId: user.id,
        });
        if (linked !== null) return { kind: 'member', user };
    }
    const subscriberId = await deps.guestCookie.read();
    if (subscriberId !== null) return { kind: 'guest', subscriberId };
    return user === null ? { kind: 'anonymous' } : { kind: 'unverified', user };
}

/**
 * 회원이 소유자일 때 비회원 때 신청한 같은 주소의 행을 먼저 이 회원에게 연결한다(`findForMember`가
 * 인증된 본인 주소로만 가져온다). 항목·제거·삭제가 모두 연결된 행을 가리켜야 하기 때문이다.
 */
export async function ownerOf(
    deps: MailAlertManageDeps,
    caller: Caller
): Promise<MailAlertOwner | null> {
    if (caller.kind === 'link') {
        return { kind: 'link', subscriberId: caller.subscriberId };
    }
    if (caller.kind === 'member') {
        await deps.subscribers.findForMember(caller.user.id);
        return { kind: 'member', userId: caller.user.id };
    }
    if (caller.kind === 'guest') {
        return { kind: 'guest', subscriberId: caller.subscriberId };
    }
    return null;
}

/** 쿠키가 가리키던 행이 없어졌다(수신 거부로 지워졌거나 회원에게 연결됐다). 쿠키만 비운다. */
export async function forgetStaleCookie(
    deps: MailAlertFlowDeps,
    caller: Caller
): Promise<void> {
    if (caller.kind === 'guest') await deps.guestCookie.clear();
}

function consentSourceOf(topic: MailAlertTopic): MailAlertConsentSource {
    switch (topic.kind) {
        case 'symbol':
            return 'symbol';
        case 'fear_greed':
            return 'fear_greed';
        case 'signal':
            return 'signal_hub';
    }
}

/**
 * 두 요청이 같은 회원을 동시에 연결하면 `user_id` 유니크(23505)에 한쪽이 걸릴 수 있다. 다시 시도하면
 * 상대가 커밋한 행이 보여 주소로 같은 행을 찾으므로(이미 연결됨) 한 번만 재시도한다.
 */
export async function upsertVerifiedOnce(
    deps: MailAlertFlowDeps,
    email: string,
    consentSource: MailAlertConsentSource
): Promise<{ id: string; created: boolean }> {
    const attempt = () =>
        deps.subscribers.upsertVerified({
            email,
            locale: deps.locale,
            consentSource,
        });
    return attempt().catch((error: unknown) => {
        if (!isUniqueViolationError(error)) throw error;
        return attempt();
    });
}

function hasTopic(
    rows: readonly { kind: string; key: string }[],
    topic: MailAlertTopic
): boolean {
    const wanted = topicToRow(topic);
    return rows.some(row => row.kind === wanted.kind && row.key === wanted.key);
}

/**
 * 로그인한 회원이 자기 계정 주소로 방금 코드 확인을 마쳤다면 그 행을 계정에 연결한다. 계정 이메일이 아직
 * 인증 전이면 `upsertVerified`가 연결하지 못하고, 그러면 탈퇴 때 행이 남는다(방침 §4는 탈퇴 시 즉시 파기를
 * 약속한다). 주소 일치는 여기서도 저장소가 문장 안에서 다시 확인한다. 이미 연결된 행이면 아무 일도 없다.
 */
export async function linkSessionMember(
    deps: MailAlertFlowDeps,
    verifiedEmail: string,
    subscriberId: string
): Promise<void> {
    const user = await deps.currentUser();
    if (user === null || user.email !== verifiedEmail) return;
    await deps.subscribers.linkVerifiedMember(user.id, subscriberId);
}

/** 대화상자가 열릴 때의 상태. 읽기 전용이라 한도도 쓰지 않는다. */
export async function getMailAlertState(
    deps: MailAlertFlowDeps,
    topicInput: unknown
): Promise<MailAlertState> {
    const topic = parseTopic(topicInput);
    if (!isEnabled(deps) || topic === null) return { status: 'unavailable' };

    const caller = await resolveCaller(deps, undefined);
    if (caller.kind === 'anonymous') {
        return { status: 'new', accountEmail: null };
    }
    if (caller.kind === 'unverified') {
        return { status: 'new', accountEmail: caller.user.email };
    }
    if (caller.kind === 'member') {
        const row = await deps.subscribers.findForMember(caller.user.id);
        const topics =
            row === null
                ? []
                : await deps.subscribers.listTopics({
                      kind: 'member',
                      userId: caller.user.id,
                  });
        const maskedEmail = maskEmail(caller.user.email);
        return hasTopic(topics, topic)
            ? { status: 'subscribed', maskedEmail }
            : {
                  status: 'member',
                  maskedEmail,
                  includePortfolio: row?.includePortfolio ?? false,
              };
    }
    const owner: MailAlertOwner = {
        kind: 'guest',
        subscriberId: caller.subscriberId,
    };
    const row = await deps.subscribers.findByOwner(owner);
    if (row === null) {
        await forgetStaleCookie(deps, caller);
        return { status: 'new', accountEmail: null };
    }
    const topics = await deps.subscribers.listTopics(owner);
    const maskedEmail = maskEmail(row.email);
    return hasTopic(topics, topic)
        ? { status: 'subscribed', maskedEmail }
        : { status: 'known', maskedEmail };
}

/**
 * 액션이 받는 입력은 믿을 수 없는 값이다. 폼은 `FormData` 그대로, 훅이 부른 호출은 평범한 객체로 오며
 * 둘 다 종류별 허용 목록 검증(`parseTopicInput`)을 거친다.
 */
function parseTopic(input: unknown): MailAlertTopic | null {
    if (input instanceof FormData) return parseTopicInput(input);
    return typeof input === 'object' && input !== null
        ? parseTopicInput(Object.fromEntries(Object.entries(input)))
        : null;
}

/** 1단계: 입력한 주소로 인증 코드를 보낸다. 봇 함정이 채워졌으면 성공처럼 응답하고 아무것도 보내지 않는다. */
export async function requestMailAlertCodeFlow(
    deps: MailAlertFlowDeps,
    input: { readonly email: string; readonly honeypotFilled: boolean }
): Promise<MailAlertRequestCodeState> {
    if (!isEnabled(deps) || deps.emailTokens === null) {
        return { status: 'unavailable' };
    }
    if (input.honeypotFilled) {
        return { status: 'code_sent', email: input.email.trim() };
    }
    const result = await requestMailAlertCode(input.email, {
        emailTokens: deps.emailTokens,
        emailDispatcher: deps.emailDispatcher,
        rateLimit: deps.rateLimit,
        resetCounter: deps.resetCounter,
        ipHash: await deps.ipHash(),
        buildMessage: deps.buildCodeMessage,
    });
    return result;
}

/**
 * 2단계: 코드를 확인하고 구독자 행과 이 화면의 항목을 만든다. 주소로 연결할 인증된 회원이 있으면 행이
 * 그 회원에게 붙고(저장소가 같은 문장에서 정한다) 그 경우 쿠키는 필요 없다 — 회원은 세션으로 들어온다.
 * 응답은 계정이나 구독자가 이미 있었는지에 따라 달라지지 않는다.
 */
export async function confirmMailAlertFlow(
    deps: MailAlertFlowDeps,
    input: {
        readonly email: string;
        readonly code: string;
        readonly topicInput: unknown;
    }
): Promise<MailAlertConfirmState> {
    const topic = parseTopic(input.topicInput);
    if (!isEnabled(deps) || deps.emailTokens === null) {
        return { status: 'unavailable' };
    }
    if (topic === null) return { status: 'invalid' };

    const outcome = await confirmMailAlertCode(input.email, input.code, {
        emailTokens: deps.emailTokens,
        rateLimit: deps.rateLimit,
        ipHash: await deps.ipHash(),
    });
    if (outcome.status === 'invalid_email') return { status: 'invalid' };
    if (outcome.status !== 'verified') return { status: outcome.status };

    const { id } = await upsertVerifiedOnce(
        deps,
        outcome.email,
        consentSourceOf(topic)
    );
    await linkSessionMember(deps, outcome.email, id);
    const row = topicToRow(topic);
    const asGuest = await deps.subscribers.addTopic(
        { kind: 'guest', subscriberId: id },
        row,
        MAIL_ALERT_MAX_TOPICS
    );
    const maskedEmail = maskEmail(outcome.email);
    if (asGuest !== 'subscriber_missing') {
        if (asGuest === 'limit_reached') return { status: 'limit_reached' };
        await deps.guestCookie.write(id);
        return { status: 'subscribed', maskedEmail };
    }
    // 행이 인증된 회원에게 연결돼 있다(비회원 소유자로는 닿지 않는다) — 그 회원 소유자로 담는다.
    const member = await deps.users.findByEmail(outcome.email);
    if (member === null) return { status: 'unavailable' };
    const asMember = await deps.subscribers.addTopic(
        { kind: 'member', userId: member.id },
        row,
        MAIL_ALERT_MAX_TOPICS
    );
    if (asMember === 'subscriber_missing') return { status: 'unavailable' };
    return asMember === 'limit_reached'
        ? { status: 'limit_reached' }
        : { status: 'subscribed', maskedEmail };
}

/**
 * 코드 없이 항목을 더한다: 이메일이 인증된 회원(세션)이거나 같은 브라우저의 서명된 쿠키가 있을 때만이다.
 * 둘 다 아니면 `needs_code`.
 */
export async function addMailAlertTopicFlow(
    deps: MailAlertFlowDeps,
    topicInput: unknown,
    options: { readonly includePortfolio: boolean }
): Promise<MailAlertAddResult> {
    const topic = parseTopic(topicInput);
    if (!isEnabled(deps)) return { status: 'unavailable' };
    if (topic === null) return { status: 'invalid' };

    const allowed = await deps.rateLimit({
        key: `mail-alert:topic:ip:${await deps.ipHash()}`,
        ...MAIL_ALERT_RATE_LIMITS.topicAddPerIp,
    });
    if (!allowed) return { status: 'rate_limited' };

    const caller = await resolveCaller(deps, undefined);
    const row = topicToRow(topic);
    if (caller.kind === 'member') {
        const existing = await deps.subscribers.findForMember(caller.user.id);
        if (existing === null) {
            await upsertVerifiedOnce(
                deps,
                caller.user.email,
                consentSourceOf(topic)
            );
        }
        const owner: MailAlertOwner = {
            kind: 'member',
            userId: caller.user.id,
        };
        const outcome = await deps.subscribers.addTopic(
            owner,
            row,
            MAIL_ALERT_MAX_TOPICS
        );
        if (outcome === 'limit_reached') return { status: 'limit_reached' };
        if (outcome === 'subscriber_missing') return { status: 'needs_code' };
        if (options.includePortfolio) {
            await deps.subscribers.setIncludePortfolio(owner, true);
        }
        return {
            status: 'subscribed',
            maskedEmail: maskEmail(caller.user.email),
        };
    }
    if (caller.kind !== 'guest') return { status: 'needs_code' };

    const owner: MailAlertOwner = {
        kind: 'guest',
        subscriberId: caller.subscriberId,
    };
    const outcome = await deps.subscribers.addTopic(
        owner,
        row,
        MAIL_ALERT_MAX_TOPICS
    );
    if (outcome === 'limit_reached') return { status: 'limit_reached' };
    if (outcome === 'subscriber_missing') {
        await forgetStaleCookie(deps, caller);
        return { status: 'needs_code' };
    }
    const subscriber = await deps.subscribers.findByOwner(owner);
    return subscriber === null
        ? { status: 'needs_code' }
        : { status: 'subscribed', maskedEmail: maskEmail(subscriber.email) };
}

/** 항목 하나를 뺀다. 마지막 항목이면 구독자도 지워진다. */
export async function removeMailAlertTopicFlow(
    deps: MailAlertFlowDeps,
    topicInput: unknown,
    link: MailAlertLinkAuth | undefined
): Promise<MailAlertChangeResult> {
    const topic = parseTopic(topicInput);
    if (!isEnabled(deps)) return { status: 'unavailable' };
    if (topic === null) return { status: 'invalid' };

    const caller = await resolveCaller(deps, link);
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'not_found' };
    const result = await deps.subscribers.removeTopic(owner, topicToRow(topic));
    if (!result.deleted) {
        return { status: 'not_found' };
    }
    if (result.subscriberDeleted) {
        await forgetStaleCookie(deps, caller);
        return { status: 'subscriber_removed' };
    }
    return { status: 'ok' };
}

/** 알림 메일을 모두 그만 받는다(구독자 삭제). */
export async function unsubscribeMailAlertFlow(
    deps: MailAlertFlowDeps,
    link: MailAlertLinkAuth | undefined
): Promise<MailAlertChangeResult> {
    if (!isEnabled(deps)) return { status: 'unavailable' };
    const caller = await resolveCaller(deps, link);
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'not_found' };
    const deleted = await deps.subscribers.deleteByOwner(owner);
    if (!deleted) return { status: 'not_found' };
    await forgetStaleCookie(deps, caller);
    return { status: 'subscriber_removed' };
}

/** 보유 종목·관심종목 함께 받기 스위치 — 회원 것이라 회원만 바꾼다. */
export async function setMailAlertIncludePortfolioFlow(
    deps: MailAlertFlowDeps,
    value: boolean
): Promise<MailAlertChangeResult> {
    if (!isEnabled(deps)) return { status: 'unavailable' };
    const caller = await resolveCaller(deps, undefined);
    if (caller.kind !== 'member') return { status: 'not_found' };
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'not_found' };
    const result = await deps.subscribers.setIncludePortfolio(owner, value);
    if (!result.found) return { status: 'not_found' };
    return result.subscriberDeleted
        ? { status: 'subscriber_removed' }
        : { status: 'ok' };
}

/** 저장 행 → 화면 모양. 제안 id·구독자 id 같은 화면이 몰라도 되는 값은 싣지 않는다. */
function toPriceAlertView(record: PriceAlertRecord): PriceAlertView {
    return {
        id: record.id,
        symbol: record.symbol,
        market: record.market,
        condition: record.condition,
        basis: record.basis,
        analysisAt: record.analysisAt,
        referenceClose: record.referenceClose,
        createdAt: record.createdAt,
        expiresOn: record.expiresOn,
        status: record.status,
        firedSession: record.firedSession,
        firedClose: record.firedClose,
        firedAt: record.firedAt,
    };
}

/**
 * 가격대 알림 하나를 지운다. 소유자는 항목 제거와 같은 규칙(링크 서명 → 세션 회원 → 쿠키)으로 정하고, 알림 id가
 * 그 소유자의 것이 아니면 저장소가 아무 행도 가리키지 못해 `not_found`다. 알림이 마지막 받을 것이었으면
 * 구독자도 지워진다(`subscriber_removed`).
 */
export async function cancelPriceAlertFlow(
    deps: MailAlertFlowDeps,
    alertId: unknown,
    link: MailAlertLinkAuth | undefined
): Promise<MailAlertChangeResult> {
    if (!isEnabled(deps) || !deps.priceAlertsEnabled) {
        return { status: 'unavailable' };
    }
    if (typeof alertId !== 'string' || !UUID_PATTERN.test(alertId)) {
        return { status: 'invalid' };
    }
    const caller = await resolveCaller(deps, link);
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'not_found' };
    const result = await deps.priceAlerts.cancel(owner, alertId);
    if (!result.deleted) return { status: 'not_found' };
    if (result.subscriberDeleted) {
        await forgetStaleCookie(deps, caller);
        return { status: 'subscriber_removed' };
    }
    return { status: 'ok' };
}

export type MailAlertManageLoad =
    | { readonly status: 'ready'; readonly view: MailAlertManageView }
    | { readonly status: 'empty' }
    | { readonly status: 'unidentified' }
    | { readonly status: 'unavailable' };

/**
 * 설정 화면의 현재 상태. 호출자를 알아보지 못하면 `unidentified`(메일 속 링크로 열어 달라는 안내),
 * 알아봤지만 받는 항목이 없으면 `empty`. RSC 렌더가 부르므로 쿠키를 쓰지 않는다: 쿠키가 가리키는 행이
 * 없으면(낡은 쿠키) 그대로 `unidentified`이고, 쿠키 정리는 액션이 한다.
 */
export async function loadMailAlertManage(
    deps: MailAlertManageDeps,
    link: MailAlertLinkAuth | undefined
): Promise<MailAlertManageLoad> {
    if (!isEnabled(deps)) return { status: 'unavailable' };
    const caller = await resolveCaller(deps, link);
    if (caller.kind === 'anonymous' || caller.kind === 'unverified') {
        return { status: 'unidentified' };
    }
    const owner = await ownerOf(deps, caller);
    if (owner === null) return { status: 'unidentified' };
    const row =
        caller.kind === 'member'
            ? await deps.subscribers.findForMember(caller.user.id)
            : await deps.subscribers.findByOwner(owner);
    if (row === null) {
        return caller.kind === 'member'
            ? { status: 'empty' }
            : { status: 'unidentified' };
    }
    const rows = await deps.subscribers.listTopics(owner);
    const alerts = deps.priceAlertsEnabled
        ? (await deps.priceAlerts.listForSubscriber(owner)).map(
              toPriceAlertView
          )
        : [];
    const asOf = priceAlertAsOf(new Date());
    return {
        status: 'ready',
        view: {
            maskedEmail: maskEmail(row.email),
            topics: rows.flatMap(topicRow => rowToTopic(topicRow) ?? []),
            includePortfolio:
                caller.kind === 'member' ? row.includePortfolio : null,
            // 만료 세션을 판정하는 실행이 지났지만 아직 정리되지 않은 진행 중 알림은 더는 판정되지 않으니 보이지 않는다.
            priceAlerts: alerts.filter(
                alert =>
                    alert.status === 'active' && isPriceAlertLive(alert, asOf)
            ),
            firedPriceAlerts: alerts
                .filter(alert => alert.status === 'fired')
                .toSorted(
                    (a, b) =>
                        (b.firedAt?.getTime() ?? 0) -
                        (a.firedAt?.getTime() ?? 0)
                ),
        },
    };
}
