'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { subscribeSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';
import {
    markSymbolNudged,
    recordSymbolAnalysis,
    shouldShowSetupNudge,
} from '../lib/memberNudgePolicy';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '../lib/memberNudgeStorage';

/** 띄울 넛지. `setup`은 메일 리포트 설정 권유(보유∪관심 종목 수), `symbol`은 리포트 대상 밖 종목 담기 권유. */
export type EmailReportNudge =
    | { kind: 'setup'; symbolCount: number }
    | { kind: 'symbol'; symbol: string };

/**
 * 넛지를 띄우지 않는 경로 — 설정·인증·수신거부 화면 자체에서는 권할 게 없거나 방해만 된다.
 * 앞부분 일치로 판정한다(`/account/delete` 등 하위 경로 포함).
 */
const EXCLUDED_PATH_PREFIXES = [
    '/account',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/email-report',
] as const;

function isExcludedPath(pathname: string): boolean {
    return EXCLUDED_PATH_PREFIXES.some(
        prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

/** 저장소 변경을 구독하지 않는다 — 플래그는 이 훅이 직접 쓰고, 다른 탭의 변경은 따라가지 않는다. */
const noopSubscribe = (): (() => void) => () => {};

/**
 * 설정 넛지 처리 결과. `deferred`는 이번 탭 세션에 다른 넛지가 이미 떠서 미룬 경우다 —
 * 세션 플래그는 탭을 닫기 전에는 풀리지 않으므로, 같은 탭의 SPA 이동에서는 다시 판정하지
 * 않고 다음 세션(새 탭·재방문)에 권한다.
 */
type SetupOutcome = 'shown' | 'alreadyEnabled' | 'deferred';

/**
 * 판정과 모달은 **어느 회원의 것인지**를 함께 들고 다닌다. 호스트는 루트 레이아웃에 계속
 * 마운트돼 있어서, 새로고침 없이 회원이 바뀌면(로그아웃 → 다른 계정 로그인) 앞 회원의
 * 판정이 새 회원 이름으로 저장되거나 앞 회원의 모달이 남을 수 있다.
 */
interface SetupDecision {
    userId: string;
    outcome: SetupOutcome;
}
interface OpenNudge {
    userId: string;
    nudge: EmailReportNudge;
}

/**
 * 회원 메일 리포트 넛지 두 가지를 판정한다. 루트 레이아웃의 호스트가 한 번 마운트한다.
 *
 * 1. **설정 권유(회원당 1회, 어느 페이지에서든)** — 보유 또는 관심종목이 있고, 이메일이 인증됐고,
 *    메일 리포트가 꺼진 회원. 수신 설정은 후보일 때만 조회한다(모든 페이지에서 회원마다
 *    Server Action을 보내지 않도록). 이미 켠 회원은 기록해 두고 다시 조회하지 않는다.
 * 2. **종목 담기 권유** — 리포트 대상(보유∪관심) 밖 종목을 누적 3회 이상 분석하면. 같은 종목엔 한 번,
 *    종목 넛지끼리 7일 간격(`memberNudgePolicy`). 이메일 인증 회원만 센다 — 인증 전에는 담아도
 *    메일이 나가지 않으므로 권하지 않고, 인증 전 분석 횟수도 쌓지 않는다.
 *
 * 한 탭 세션에는 어떤 넛지든 하나만 띄운다(`nudgeSession`, 비회원 가입 넛지와 공유).
 * 기록은 localStorage에 회원 id별로 둔다 — 기기를 바꾸면 한 번 더 뜰 수 있는 소프트 넛지다.
 */
export interface UseEmailReportNudgeResult {
    /** 지금 띄울 넛지(현재 회원의 것만). 없으면 `null`. */
    nudge: EmailReportNudge | null;
    close: () => void;
}

export function useEmailReportNudge(): UseEmailReportNudgeResult {
    const [openNudge, setOpenNudge] = useState<OpenNudge | null>(null);
    const [setupDecision, setSetupDecision] = useState<SetupDecision | null>(
        null
    );
    const pathname = useAppPathname();
    const { data: user } = useCurrentUser();

    const userId = user?.id ?? null;
    const nudge =
        openNudge !== null && openNudge.userId === userId
            ? openNudge.nudge
            : null;
    // 저장된 "설정 넛지 이미 띄움" 플래그. 서버 스냅샷은 true(=띄우지 않음) — 회원 정보는
    // 하이드레이션 뒤에야 오므로 서버 렌더와 어긋날 일이 없다.
    const storedSetupShown = useSyncExternalStore(
        noopSubscribe,
        () =>
            userId === null ? true : readMemberNudgeRecord(userId).setupShown,
        () => true
    );

    const isVerifiedMember = user != null && user.emailVerified;
    const isExcluded = isExcludedPath(pathname);
    // 보유종목은 설정 권유를 아직 판정해야 할 때만 직접 조회한다 — 이 호스트는 모든 라우트에
    // 마운트되므로, 그렇지 않으면 회원이 페이지를 열 때마다 Server Action이 하나씩 더 나가
    // 다른 액션을 그만큼 늦춘다. 종목 넛지는 종목 페이지가 이미 받아 둔 같은 키의 캐시를 읽는다.
    const { holdings, hasData: hasHoldings } = usePortfolioHoldings({
        enabled: isVerifiedMember && !storedSetupShown && !isExcluded,
    });

    // 관심종목은 헤더 메뉴 뱃지가 같은 React Query 키로 이미 받아 두므로 추가 요청이 없다.
    // 목록이 도착하기 전(하이드레이션 전·회원 여부 미확정)의 빈 목록은 "관심종목 없음"이 아니므로,
    // 알 때까지 세지도 판정하지도 않는다 — 그렇지 않으면 관심종목만 있는 회원에게 거짓 판정이 난다.
    const watchlist = useWatchlist();
    const isWatchlistKnown =
        watchlist.isHydrated && !watchlist.isIdentityPending;
    const symbolCount = new Set([
        ...holdings.map(h => h.symbol.toUpperCase()),
        ...watchlist.items.map(i => i.symbol.toUpperCase()),
    ]).size;

    const isSetupCandidate =
        isVerifiedMember &&
        hasHoldings &&
        isWatchlistKnown &&
        symbolCount > 0 &&
        !isExcluded &&
        !storedSetupShown &&
        setupDecision?.userId !== user.id;
    const { settings } = useEmailReportSettings({ enabled: isSetupCandidate });

    // 렌더 중 조정(EF-1) — 수신 설정이 도착한 이번 렌더에 한 번만 판정한다. 여기서
    // localStorage·sessionStorage를 읽어도 안전한 이유: 이 분기는 회원 정보와 수신 설정이
    // 모두 도착한 뒤(= 하이드레이션 이후 클라이언트)에만 들어오고, 판정 결과를 상태에 고정해
    // `setupDecision`이 생기면 다시 들어오지 않는다. 재렌더·StrictMode 이중 렌더에서 다시
    // 읽어도 같은 값이 나오고, 쓰기는 아래 effect에서만 한다.
    if (isSetupCandidate && settings != null && user != null) {
        const show = shouldShowSetupNudge(readMemberNudgeRecord(user.id), {
            emailVerified: user.emailVerified,
            holdingsCount: holdings.length,
            watchlistCount: watchlist.items.length,
            reportEnabled: settings.enabled,
        });
        if (!show) {
            setSetupDecision({ userId: user.id, outcome: 'alreadyEnabled' });
        } else if (hasNudgeShownThisSession() || nudge !== null) {
            setSetupDecision({ userId: user.id, outcome: 'deferred' });
        } else {
            setSetupDecision({ userId: user.id, outcome: 'shown' });
            setOpenNudge({
                userId: user.id,
                nudge: { kind: 'setup', symbolCount },
            });
        }
    }

    // 판정 결과를 저장소에 남긴다. 미룬 경우는 남기지 않는다 — 다음 세션에 다시 권한다.
    // 판정한 회원의 id로 쓴다 — 지금 로그인한 회원이 아니라.
    useEffect(() => {
        if (setupDecision === null) return;
        const { userId: decidedFor, outcome } = setupDecision;
        if (outcome !== 'shown' && outcome !== 'alreadyEnabled') return;
        writeMemberNudgeRecord(decidedFor, {
            ...readMemberNudgeRecord(decidedFor),
            setupShown: true,
        });
        if (outcome === 'shown') markNudgeShownThisSession();
    }, [setupDecision]);

    // 구독 콜백이 최신 값을 읽도록 렌더마다 갱신한다(구독은 한 번만 건다).
    const latestRef = useRef({
        user,
        holdings,
        hasHoldings,
        isWatchlistKnown,
        watchlistHas: watchlist.has,
    });
    useEffect(() => {
        latestRef.current = {
            user,
            holdings,
            hasHoldings,
            isWatchlistKnown,
            watchlistHas: watchlist.has,
        };
    });

    useEffect(
        () =>
            subscribeSymbolAnalyzed(symbol => {
                const latest = latestRef.current;
                if (latest.user == null || !latest.user.emailVerified) return;
                // 보유·관심종목을 모르면 리포트 대상 밖인지 판정할 수 없어 세지 않는다.
                if (!latest.hasHoldings || !latest.isWatchlistKnown) return;
                const upper = symbol.toUpperCase();
                const inReportSet =
                    latest.holdings.some(
                        h => h.symbol.toUpperCase() === upper
                    ) || latest.watchlistHas(upper);
                const now = Date.now();
                const { record, shouldNudge } = recordSymbolAnalysis(
                    readMemberNudgeRecord(latest.user.id),
                    upper,
                    inReportSet,
                    now
                );
                if (shouldNudge && !hasNudgeShownThisSession()) {
                    writeMemberNudgeRecord(
                        latest.user.id,
                        markSymbolNudged(record, upper, now)
                    );
                    markNudgeShownThisSession();
                    setOpenNudge({
                        userId: latest.user.id,
                        nudge: { kind: 'symbol', symbol: upper },
                    });
                    return;
                }
                writeMemberNudgeRecord(latest.user.id, record);
            }),
        []
    );

    const close = useCallback(() => setOpenNudge(null), []);
    return { nudge, close };
}
