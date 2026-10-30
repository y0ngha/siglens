'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { hasNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import { shouldShowSetupNudge } from '../lib/memberNudgePolicy';
import { readMemberNudgeRecord } from '../lib/memberNudgeStorage';
import {
    decideSetupOutcome,
    decideSymbolOutcome,
    isSetupNudgeCandidate,
    type EmailReportNudge,
    type SetupDecision,
    type SymbolPending,
} from '../lib/nudgeDecisions';
import { isNudgeExcludedPath } from '../lib/nudgePaths';
import { countReportSymbols } from '../lib/reportSet';
import { usePersistNudgeDecisions } from './usePersistNudgeDecisions';
import { useSymbolNudgeCandidates } from './useSymbolNudgeCandidates';

/** 저장소 변경을 구독하지 않는다 — 플래그는 이 훅이 직접 쓰고, 다른 탭의 변경은 따라가지 않는다. */
const noopSubscribe = (): (() => void) => () => {};

/** 열린 모달과 그 모달을 받은 회원 — 회원이 바뀌면 앞 회원의 모달을 숨긴다(`SetupDecision` 참조). */
interface OpenNudge {
    userId: string;
    nudge: EmailReportNudge;
}

/** {@link useEmailReportNudge}의 결과. 호스트(`EmailReportNudgeHost`)가 모달을 그리는 데 쓴다. */
export interface UseEmailReportNudgeResult {
    /** 지금 띄울 넛지(현재 회원의 것만). 없으면 `null`. */
    nudge: EmailReportNudge | null;
    /** 모달을 닫는다(안정 참조). 닫은 넛지는 다시 띄우지 않는다. */
    close: () => void;
}

/**
 * 회원 메일 리포트 넛지 두 가지를 판정한다. 루트 레이아웃의 호스트가 한 번 마운트한다.
 *
 * 1. **설정 권유(회원당 1회, 어느 페이지에서든)** — 보유 또는 관심종목이 있고, 이메일이 인증됐고,
 *    메일 리포트가 꺼진 회원. 수신 설정은 후보일 때만 조회한다(모든 페이지에서 회원마다
 *    Server Action을 보내지 않도록). 이미 켠 회원은 기록해 두고 다시 조회하지 않는다.
 * 2. **종목 담기 권유** — 리포트 대상(보유∪관심) 밖 종목을 누적 3회 이상 분석하면. 같은 종목엔 한 번,
 *    종목 넛지끼리 7일 간격(`memberNudgePolicy`). 횟수 집계는 `useSymbolNudgeCandidates`가 한다.
 *
 * 한 탭 세션에는 어떤 넛지든 하나만 띄운다(`nudgeSession`, 비회원 가입 넛지와 공유).
 * 기록은 localStorage에 회원 id별로 둔다 — 기기를 바꾸면 한 번 더 뜰 수 있는 소프트 넛지다.
 * 판정은 렌더 중 조정(REACT.md#EF-1)으로 상태에 고정하고, 저장은 `usePersistNudgeDecisions`가 한다.
 */
export function useEmailReportNudge(): UseEmailReportNudgeResult {
    const [openNudge, setOpenNudge] = useState<OpenNudge | null>(null);
    const [setupDecision, setSetupDecision] = useState<SetupDecision | null>(
        null
    );
    const [symbolPending, setSymbolPending] = useState<SymbolPending | null>(
        null
    );
    // 이 탭에서 수신 설정이 꺼진 것으로 확인된 회원. 알려진 동안은 종목 넛지 후보를 만들지 않아
    // 분석할 때마다 수신 설정을 다시 조회하지 않는다(쿼리 staleTime 1분 뒤에는 재조회된다).
    const [reportOffUserId, setReportOffUserId] = useState<string | null>(null);
    const pathname = useAppPathname();
    const { data: user } = useCurrentUser();
    // 관심종목은 헤더 메뉴 뱃지가 같은 React Query 키로 이미 받아 두므로 추가 요청이 없다.
    const watchlist = useWatchlist();
    usePersistNudgeDecisions(setupDecision, symbolPending);
    const close = useCallback(() => setOpenNudge(null), []);

    const userId = user?.id ?? null;
    const nudge = openNudge?.userId === userId ? openNudge.nudge : null;
    // REACT.md#HK-1 예외: 파생값 `userId`를 읽으므로 그 바로 뒤에 둔다.
    // 저장된 "설정 넛지 이미 띄움" 플래그. 서버 스냅샷은 true(=띄우지 않음) — 회원 정보는
    // 하이드레이션 뒤에야 오므로 서버 렌더와 어긋날 일이 없다.
    const storedSetupShown = useSyncExternalStore(
        noopSubscribe,
        () =>
            userId === null ? true : readMemberNudgeRecord(userId).setupShown,
        () => true
    );

    const isVerifiedMember = user != null && user.emailVerified;
    const isExcluded = isNudgeExcludedPath(pathname);
    // 보유종목은 설정 권유를 아직 판정해야 할 때만 직접 조회한다 — 이 호스트는 모든 라우트에
    // 마운트되므로, 그렇지 않으면 회원이 페이지를 열 때마다 Server Action이 하나씩 더 나가
    // 다른 액션을 그만큼 늦춘다. 종목 넛지는 종목 페이지가 이미 받아 둔 같은 키의 캐시를 읽는다.
    // REACT.md#HK-1 예외: 파생값 `isVerifiedMember`·`isExcluded`를 입력으로 받는다.
    const { holdings, hasData: hasHoldings } = usePortfolioHoldings({
        enabled: isVerifiedMember && !storedSetupShown && !isExcluded,
    });

    // 목록이 도착하기 전(하이드레이션 전·회원 여부 미확정)의 빈 목록은 "관심종목 없음"이 아니므로,
    // 알 때까지 세지도 판정하지도 않는다 — 그렇지 않으면 관심종목만 있는 회원에게 거짓 판정이 난다.
    const isWatchlistKnown =
        watchlist.isHydrated && !watchlist.isIdentityPending;
    const symbolCount = countReportSymbols(holdings, watchlist.items);

    const isSetupCandidate =
        isVerifiedMember &&
        isSetupNudgeCandidate({
            hasHoldings,
            isWatchlistKnown,
            symbolCount,
            isExcluded,
            storedSetupShown,
            isDecidedThisTab: setupDecision?.userId === user.id,
        });
    const awaitingSymbol =
        symbolPending?.status === 'awaiting' && symbolPending.userId === userId
            ? symbolPending
            : null;
    // REACT.md#HK-1 예외: 파생값 `isSetupCandidate`·`awaitingSymbol`을 입력으로 받는다.
    const { settings } = useEmailReportSettings({
        enabled: isSetupCandidate || awaitingSymbol !== null,
    });

    // REACT.md#HK-1 예외: 보유종목 조회 결과와 파생값 `isWatchlistKnown`을 입력으로 받는다.
    useSymbolNudgeCandidates({
        user,
        holdings,
        hasHoldings,
        isWatchlistKnown,
        isWatched: watchlist.has,
        reportOffUserId,
        onCandidate: candidate =>
            setSymbolPending({ ...candidate, status: 'awaiting' }),
    });

    // 렌더 중 조정 — 설정을 바꿀 수 있는 화면(설정·계정)에 들어오면 "꺼져 있음" 기억을 버려
    // 켜고 돌아온 회원이 다시 후보가 되게 한다.
    if (isExcluded && reportOffUserId !== null) {
        setReportOffUserId(null);
    }

    // 렌더 중 조정 — 종목 넛지 후보는 수신 설정이 도착한 이번 렌더에 한 번만 판정한다.
    // 알 수 없는 동안(`undefined`)은 판정하지 않는다. 꺼져 있음은 기억해 다음 후보를 막는다.
    if (awaitingSymbol !== null && settings !== undefined) {
        const reportEnabled = settings?.enabled === true;
        const outcome = decideSymbolOutcome(
            reportEnabled,
            hasNudgeShownThisSession() || nudge !== null
        );
        setSymbolPending({ ...awaitingSymbol, status: outcome });
        if (outcome === 'shown') {
            setOpenNudge({
                userId: awaitingSymbol.userId,
                nudge: { kind: 'symbol', symbol: awaitingSymbol.symbol },
            });
        }
        if (!reportEnabled) setReportOffUserId(awaitingSymbol.userId);
    }

    // 렌더 중 조정 — 수신 설정이 도착한 이번 렌더에 한 번만 판정한다. 여기서
    // localStorage·sessionStorage를 읽어도 안전한 이유: 이 분기는 회원 정보와 수신 설정이
    // 모두 도착한 뒤(= 하이드레이션 이후 클라이언트)에만 들어오고, 판정 결과를 상태에 고정해
    // `setupDecision`이 생기면 다시 들어오지 않는다. 재렌더·StrictMode 이중 렌더에서 다시
    // 읽어도 같은 값이 나온다.
    if (isSetupCandidate && settings != null && user != null) {
        const outcome = decideSetupOutcome(
            shouldShowSetupNudge(readMemberNudgeRecord(user.id), {
                emailVerified: user.emailVerified,
                holdingsCount: holdings.length,
                watchlistCount: watchlist.items.length,
                reportEnabled: settings.enabled,
            }),
            hasNudgeShownThisSession() || nudge !== null
        );
        setSetupDecision({ userId: user.id, outcome });
        if (outcome === 'shown') {
            setOpenNudge({
                userId: user.id,
                nudge: { kind: 'setup', symbolCount },
            });
        }
    }

    return { nudge, close };
}
