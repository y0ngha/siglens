import 'server-only';
import { sleep } from '@/shared/lib/sleep';

const OPENFIGI_MAPPING_URL = 'https://api.openfigi.com/v3/mapping';
export const OPENFIGI_TIMEOUT_MS = 30_000;
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * OpenFIGI 한도. 키가 없으면 분당 25요청 × 요청당 10잡, 키가 있으면 6초당 25요청 × 100잡
 * (2026-10 실측: 키 없이 11잡을 보내면 `Request may only contain 10 mapping jobs`).
 */
export const LIMITS = {
    anonymous: { jobsPerRequest: 10, minIntervalMs: 2_400 },
    keyed: { jobsPerRequest: 100, minIntervalMs: 250 },
} as const;

/** 429를 받았다 — 호출부는 이번 실행을 접고 다음 실행에 이어 간다. */
export class OpenFigiRateLimitedError extends Error {
    constructor() {
        super('OpenFIGI rate limited');
        this.name = 'OpenFigiRateLimitedError';
    }
}

interface FigiJobResult {
    data?: { ticker?: string }[];
    error?: string;
    warning?: string;
}

/**
 * CUSIP 목록 → 각 CUSIP이 가리키는 티커 목록.
 *
 * ⚠️ OpenFIGI는 **CUSIP → 티커** 방향만 풀어 준다. 티커로 CUSIP을 찾을 수는 없다(응답에 CUSIP 필드가
 * 없다, 2026-10 실측). 그래서 이 클라이언트는 "후보 CUSIP이 정말 그 티커의 것인지" 확인하는 용도다.
 *
 * 한도 때문에 요청을 직렬로 보내고 사이에 간격을 둔다. `shouldStop`이 true를 돌려주면(데드라인)
 * 남은 묶음은 보내지 않는다 — 결과 맵에 없는 CUSIP은 "아직 확인 안 됨"이다.
 * 일치하는 증권이 없으면 빈 배열이다.
 */
export async function mapCusipsToTickers(
    cusips: readonly string[],
    shouldStop: () => boolean = () => false
): Promise<Map<string, string[]>> {
    const apiKey = process.env.OPENFIGI_API_KEY?.trim();
    const { jobsPerRequest, minIntervalMs } = apiKey
        ? LIMITS.keyed
        : LIMITS.anonymous;
    const result = new Map<string, string[]>();

    for (let i = 0; i < cusips.length; i += jobsPerRequest) {
        if (shouldStop()) break;
        const batch = cusips.slice(i, i + jobsPerRequest);
        // 한도를 지키려는 의도적 직렬 호출이다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const res = await fetch(OPENFIGI_MAPPING_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'X-OPENFIGI-APIKEY': apiKey } : {}),
            },
            body: JSON.stringify(
                batch.map(cusip => ({ idType: 'ID_CUSIP', idValue: cusip }))
            ),
            cache: 'no-store',
            signal: AbortSignal.timeout(OPENFIGI_TIMEOUT_MS),
        });
        if (res.status === HTTP_TOO_MANY_REQUESTS) {
            throw new OpenFigiRateLimitedError();
        }
        if (!res.ok) throw new Error(`OpenFIGI ${res.status}`);
        const body = (await res.json()) as FigiJobResult[];
        batch.forEach((cusip, index) => {
            const tickers = (body[index]?.data ?? [])
                .map(row => row.ticker)
                .filter((t): t is string => typeof t === 'string');
            result.set(cusip, [...new Set(tickers)]);
        });
        if (i + jobsPerRequest < cusips.length) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await sleep(minIntervalMs);
        }
    }
    return result;
}
