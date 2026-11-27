import 'server-only';

import {
    signReportValue,
    verifyReportValue,
} from '@/entities/email-report/lib/reportSignature';
import { MS_PER_SECOND } from '@/shared/config/time';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';
import {
    PRICE_ALERT_TOKEN_MAX_LENGTH,
    parsePriceAlertProposal,
} from '../lib/priceAlertProposal';
import type { PriceAlertProposal } from '../model';

const SEPARATOR = '.';
const SUBJECT_PREFIX = 'subject:';

/**
 * 호출자를 가리키는 서명된 해시. 제안 안에는 회원 id나 비회원 쿠키 id를 그대로 두지 않는다(대화 행에 저장되어
 * 화면에 내려간다). 같은 비밀로 서명한 값이라 서버만 같은 해시를 다시 만들 수 있다. 접두사 때문에 제안 토큰의
 * 서명과 같은 값이 될 수 없다(토큰 서명은 접두사 없는 base64url 본문에 건다).
 */
export function priceAlertSubject(secret: string, subject: string): string {
    return signReportValue(
        secret,
        'price-alert-proposal',
        `${SUBJECT_PREFIX}${subject}`
    );
}

/**
 * 제안을 `<본문>.<서명>` 토큰으로 봉한다. 본문은 제안 JSON의 base64url이고 서명은 그 문자열 전체에 건다 —
 * 정규화할 JSON이 없어 직렬화 순서가 서명을 흔들 수 없다. 액션은 토큰 하나만 받아 값과 서명을 함께 확인한다.
 */
export function signPriceAlertProposal(
    secret: string,
    proposal: PriceAlertProposal
): string {
    const body = Buffer.from(JSON.stringify(proposal), 'utf8').toString(
        'base64url'
    );
    return `${body}${SEPARATOR}${signReportValue(secret, 'price-alert-proposal', body)}`;
}

/**
 * 토큰을 검증해 제안으로 돌려준다. 길이 → 구분자 → 서명 → 본문 모양 순이며(SA-7) 어느 단계든 어긋나면 `null`이고
 * 던지지 않는다. 만료와 소유자는 호출자가 본다(상황마다 응답이 다르다).
 */
export function verifyPriceAlertProposal(
    secret: string,
    token: unknown
): PriceAlertProposal | null {
    if (
        typeof token !== 'string' ||
        token.length > PRICE_ALERT_TOKEN_MAX_LENGTH
    ) {
        return null;
    }
    const split = token.indexOf(SEPARATOR);
    if (split <= 0 || token.indexOf(SEPARATOR, split + 1) !== -1) return null;
    const body = token.slice(0, split);
    const signature = token.slice(split + 1);
    if (!verifyReportValue(secret, 'price-alert-proposal', body, signature)) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(
            Buffer.from(body, 'base64url').toString('utf8')
        );
        return isPlainRecord(parsed) ? parsePriceAlertProposal(parsed) : null;
    } catch {
        // 서명이 맞는 본문이라 서버가 쓴 값이다 — 여기까지 와서 읽지 못하면 서명 코드의 버그다. 토큰 본문은 남기지 않는다.
        console.error('[priceAlertProposalToken] signed body unreadable');
        return null;
    }
}

/** 제안이 `nowMs` 시각에 이미 만료됐는지. */
export function isPriceAlertProposalExpired(
    proposal: Pick<PriceAlertProposal, 'exp'>,
    nowMs: number
): boolean {
    return proposal.exp * MS_PER_SECOND <= nowMs;
}
