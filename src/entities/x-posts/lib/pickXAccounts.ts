import type {
    ResolvedXAccount,
    XAccountCandidate,
    XAccountRole,
} from '../model';
import { CURATED_X_ACCOUNTS } from './curatedXAccounts';

/** 위키데이터가 준 후보(핸들과, CEO면 이름). */
interface WikidataCandidates {
    companyHandles: readonly string[];
    executives: readonly { name: string | null; handles: readonly string[] }[];
}

/** X가 확인해 준 사용자. */
interface LookedUpUser {
    id: string;
    username: string;
    name: string;
    followers: number;
}

/**
 * 한 역할에서 X에 물어볼 위키데이터 후보 수의 상한. X는 조회한 사용자 수만큼 과금하고, 큰 회사는 지원·지역
 * 계정이 열 개 넘게 걸려 있다(실측: MSFT 12개).
 */
const X_CANDIDATES_PER_ROLE_MAX = 15;
/**
 * 위키데이터에서 온 계정을 쓰려면 넘어야 하는 팔로워 수. 위키데이터는 누구나 고칠 수 있어, 방금 만든 사칭 계정이
 * 걸릴 수 있다 — 그런 계정은 팔로워가 없다. 큐레이션 표의 계정에는 적용하지 않는다.
 */
const X_WIKIDATA_MIN_FOLLOWERS = 1_000;

const ROLES: readonly XAccountRole[] = ['company', 'ceo'];

/** 이 종목의 큐레이션 항목에 든 역할들 — 이 역할은 위키데이터 후보를 쓰지 않는다. */
function curatedCandidates(symbol: string): XAccountCandidate[] {
    const curated = CURATED_X_ACCOUNTS[symbol];
    if (curated === undefined) return [];
    return [
        ...(curated.company === undefined
            ? []
            : [
                  {
                      handle: curated.company,
                      role: 'company' as const,
                      name: null,
                      curated: true,
                  },
              ]),
        ...(curated.ceo === undefined
            ? []
            : [
                  {
                      handle: curated.ceo.handle,
                      role: 'ceo' as const,
                      name: curated.ceo.name,
                      curated: true,
                  },
              ]),
    ];
}

/** 큐레이션 표가 이 종목의 두 역할을 모두 채우는가 — 그러면 위키데이터를 물을 필요가 없다. */
export function isFullyCurated(symbol: string): boolean {
    const roles = new Set(curatedCandidates(symbol).map(c => c.role));
    return ROLES.every(role => roles.has(role));
}

/**
 * X에 확인할 계정 후보. 역할마다 큐레이션 표가 있으면 그 하나만, 없으면 위키데이터 후보(역할당
 * {@link X_CANDIDATES_PER_ROLE_MAX}개까지)다. 같은 핸들(대소문자 무시)은 먼저 나온 역할로 한 번만 싣는다 —
 * 회사 계정과 CEO 계정이 같은 핸들이면 회사 계정이다.
 */
export function xAccountCandidates(
    symbol: string,
    wikidata: WikidataCandidates | null
): XAccountCandidate[] {
    const curated = curatedCandidates(symbol);
    const curatedRoles = new Set(curated.map(c => c.role));
    const fromWikidata: XAccountCandidate[] =
        wikidata === null
            ? []
            : [
                  ...(curatedRoles.has('company')
                      ? []
                      : wikidata.companyHandles
                            .slice(0, X_CANDIDATES_PER_ROLE_MAX)
                            .map(handle => ({
                                handle,
                                role: 'company' as const,
                                name: null,
                                curated: false,
                            }))),
                  ...(curatedRoles.has('ceo')
                      ? []
                      : wikidata.executives
                            .flatMap(executive =>
                                executive.handles.map(handle => ({
                                    handle,
                                    role: 'ceo' as const,
                                    name: executive.name,
                                    curated: false,
                                }))
                            )
                            .slice(0, X_CANDIDATES_PER_ROLE_MAX)),
              ];
    const seen = new Set<string>();
    return [...curated, ...fromWikidata].filter(candidate => {
        const key = candidate.handle.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * 후보와 X 조회 결과로 역할마다 계정 하나를 고른다(회사 먼저, 그다음 CEO).
 *
 * - X가 모르는 핸들(조회 결과에 없음)은 버린다.
 * - 위키데이터 후보는 팔로워가 {@link X_WIKIDATA_MIN_FOLLOWERS} 미만이면 버린다.
 * - 한 역할에 후보가 여럿이면 팔로워가 가장 많은 계정이다(지원·지역 계정, 인물의 부계정을 거른다). 동률이면 핸들 순.
 * - 이름은 출처가 준 사람 이름이 있으면 그것, 없으면 X 표시 이름이다.
 */
export function pickXAccounts(
    candidates: readonly XAccountCandidate[],
    users: readonly LookedUpUser[]
): ResolvedXAccount[] {
    const byHandle = new Map(
        users.map(user => [user.username.toLowerCase(), user])
    );
    return ROLES.flatMap((role): ResolvedXAccount[] => {
        const eligible = candidates.flatMap(candidate => {
            if (candidate.role !== role) return [];
            const user = byHandle.get(candidate.handle.toLowerCase());
            if (user === undefined) return [];
            if (!candidate.curated && user.followers < X_WIKIDATA_MIN_FOLLOWERS)
                return [];
            return [{ candidate, user }];
        });
        const best = eligible.toSorted(
            (a, b) =>
                b.user.followers - a.user.followers ||
                a.user.username.localeCompare(b.user.username)
        )[0];
        if (best === undefined) return [];
        return [
            {
                userId: best.user.id,
                handle: best.user.username,
                name: best.candidate.name ?? best.user.name,
                role,
                followers: best.user.followers,
            },
        ];
    });
}
