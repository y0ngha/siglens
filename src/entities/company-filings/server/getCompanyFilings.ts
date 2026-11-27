import 'server-only';
import {
    AGENT_FILING_TEXT_MAX_CHARS,
    AGENT_FILINGS_LIST_MAX,
} from '@y0ngha/siglens-core';
import { DrizzleSecFilingsRepository } from '@/entities/investor-flows/api/investorFlowsFilingsRepository';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import {
    fetchFilingDocumentHead,
    fetchFilingIndexJson,
    fetchSubmissionsJson,
    filingFolderUrl,
    isSecBlockedError,
    SecBodyTimeoutError,
    SecSlotTimeoutError,
    submissionsFileName,
} from '@/shared/api/sec/secClient';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { SEC_FILING_HEAD_MAX_BYTES } from '@/shared/config/investorFlows';
import {
    MS_PER_DAY,
    SECONDS_PER_DAY,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { readErrorCode } from '@/shared/lib/readErrorCode';
import { extractHeadline } from '../lib/extractHeadline';
import { extractPrimaryHeadline } from '../lib/extractPrimaryHeadline';
import { htmlToText } from '../lib/htmlToText';
import { hasRecentFilings, parseSubmissions } from '../lib/parseSubmissions';
import { pickFilingDocument } from '../lib/pickFilingDocument';
import { stripExhibitPreamble } from '../lib/stripExhibitPreamble';
import { truncateFilingText } from '../lib/truncateFilingText';
import type {
    CompanyFiling,
    CompanyFilingBody,
    FilingDocument,
    FilingMeta,
    SubmissionFiling,
} from '../model';

/** 제출 목록: 새 공시가 하루에도 몇 건 생기므로 짧게. 실패는 캐시하지 않는다(fetcher가 던져 쓰기를 건너뛴다). */
const FILINGS_LIST_CACHE_TTL_SECONDS = 30 * SECONDS_PER_MINUTE;
/** 접수된 공시의 문서 선택·제목·본문은 바뀌지 않는다. */
const FILING_CACHE_TTL_SECONDS = 30 * SECONDS_PER_DAY;
/**
 * 키 접두사의 버전(`v1`·`v2`)은 저장하는 값의 모양이 바뀔 때, 또는 같은 원문에서 뽑는 값(제목·정제 본문)의 규칙이
 * 바뀔 때 올린다 — 30일 TTL이라 올리지 않으면 옛 규칙의 제목이 한 달 동안 남는다. 제출 목록 항목은 CIK별
 * `SubmissionFiling[]`.
 */
const FILINGS_LIST_CACHE_KEY_PREFIX = 'sec:filings-list:v1';
/**
 * 목록용 작은 항목 `{fileName, document, headline}` — 목록 호출은 이 키만 읽어 Redis 대역폭을 아낀다.
 *
 * v2(2026-11-16): 6-K 주 문서 본문·홍콩 공고·서한 제목, HTML 기호·폭 없는 문자 정리.
 */
const FILING_META_CACHE_KEY_PREFIX = 'sec:filing-meta:v2';
/**
 * 읽기용 항목 `FilingDocument` — 전문이 아니라 상한까지 잘라 둔 본문을 싣는다.
 *
 * v3(2026-11-16): 위 제목 규칙과 정제 본문의 기호(`&middot;`·`&euro;`)·폭 없는 문자 처리.
 */
const FILING_TEXT_CACHE_KEY_PREFIX = 'sec:filing-text:v3';

/**
 * 한 목록 호출에서 제목을 읽는 공시 수. 공시 하나가 게이트를 지나는 SEC 요청 2건(색인 + 문서 앞부분)이라
 * 6건이면 12건 ≈ 2.6초(`SEC_MIN_REQUEST_INTERVAL_MS` 220ms)다. 전역 게이트는 렌더 경로(8초 예산)와 공유되므로
 * 10건(21건 ≈ 4.6초)을 한 번에 밀어 넣지 않는다. 나머지 공시도 목록에는 나오고(`headline: null`) 접수번호로
 * 읽을 수 있다.
 */
export const FILING_META_LOAD_MAX = 6;

/**
 * 도구 경로(요청 경로)의 SEC 호출 옵션: 재시도 없음, 요청 6초, 슬롯 대기 포함 전체 8초(SERVER.md#SA-14).
 * 시간 초과는 그 공시의 `headline: null`로 흡수되고 캐시되지 않는다. 전역 게이트는 **프로세스 단위**라 앱
 * 인스턴스가 여럿이면 합친 요청률이 SEC 공정 접근 한도를 넘을 수 있다 — cron이 지키는 불변식은 이 경로를
 * 덮지 않으며, 인스턴스 간 락은 두지 않았다.
 */
const SEC_TOOL_RETRIES = 0;
const SEC_TOOL_REQUEST_TIMEOUT_MS = 6_000;
const SEC_TOOL_TOTAL_BUDGET_MS = 8_000;
const SEC_TOOL_OPTIONS = {
    maxRetries: SEC_TOOL_RETRIES,
    timeoutMs: SEC_TOOL_REQUEST_TIMEOUT_MS,
    totalBudgetMs: SEC_TOOL_TOTAL_BUDGET_MS,
} as const;

/** head 상한에 닿았는지 판정할 때 멀티바이트 문자가 잘려 줄어드는 바이트의 여유. */
const HEAD_CAP_SLACK_BYTES = 4;

type ListCompanyFilingsResult =
    | {
          status: 'ok';
          filings: CompanyFiling[];
          /**
           * 제목을 읽으려 시도한 앞쪽 공시 중 **재시도하면 읽힐 수 있는** 사유로 못 읽은 것이 있다(그 공시의 메타가
           * 거부됐고 캐시되지 않았다). 호출부는 이 목록을 길게 캐시하지 않는다. 아래는 pending이 **아니다**:
           * - 문서를 읽었지만 제목이 없는 공시(`headline: null`을 30일 캐시).
           * - SEC 차단·한도·시간 초과(`isSecContentionError` — 재시도가 한도를 더 두드린다), 또는 같은 호출에서 차단(`state.blocked`)이 있었다.
           * - 결정적 실패(색인·문서 404, 정제 후 빈 본문)가 `FILING_PUBLICATION_WINDOW_MS`를 **지난** 공시(`headline: null`을 30일 캐시).
           * 같은 결정적 실패라도 그 기간 **안**의 공시(방금 접수돼 아직 게시 전일 수 있다)는 pending이다. 그 밖의 거부(네트워크 오류 등)도 pending이다.
           */
          headlinesPending: boolean;
      }
    | { status: 'no_sec_filer' }
    | { status: 'failed' };

type ReadCompanyFilingResult =
    | { status: 'ok'; filing: CompanyFilingBody }
    | { status: 'unknown_filing' }
    | { status: 'no_sec_filer' }
    | { status: 'failed' };

type FilerLookup =
    | { status: 'ok'; cik: string }
    | { status: 'no_sec_filer' }
    | { status: 'failed' };

/**
 * 접수 직후 공시의 색인·문서가 아직 게시되지 않아 잠깐 404일 수 있는 기간(밀리초) — 접수일(`filedAt`)이 끝난 시각부터 센다.
 * 이 안의 "없음"은 일시 사유로 보고 캐시하지 않는다(`headlinesPending`으로 다음 재생성이 다시 읽는다). 가장 새 공시가 가장
 * 중요한데 30일 `headline: null`이 굳으면 안 되기 때문이다. 이 기간이 지난 "없음"은 영구하다. `filedAt`은 날짜만 있어
 * (UTC 자정 기준으로 읽는다) 접수 시각의 오차 하루를 이 값의 하루가 흡수한다.
 */
export const FILING_PUBLICATION_WINDOW_MS = 2 * MS_PER_DAY;

/** 접수일이 끝난 뒤 게시 대기 기간이 지났는가 — 지났으면 "없음"이 영구하다. */
function isPastPublicationWindow(filedAt: string): boolean {
    const endOfFiledDay = Date.parse(`${filedAt}T00:00:00Z`) + MS_PER_DAY;
    return Date.now() - endOfFiledDay > FILING_PUBLICATION_WINDOW_MS;
}

/**
 * 재시도해도 같은 결과인 결정적 실패(색인·문서가 없다고 응답했거나 정제하면 본문이 비는 공시). 던져서 문서 캐시(`loadFilingDocument`)에는
 * 남기지 않지만, 제목 메타(`loadFilingMeta`)는 이것을 `headline: null`로 30일 캐시한다 — 안 그러면 그 공시가 매 목록 호출마다 거부돼
 * 목록 소비자가 영구히 "제목 대기" 상태로 본다(`headlinesPending`).
 */
class PermanentFilingFailure extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PermanentFilingFailure';
    }
}

/**
 * 요청 시간 초과(abort) 판정.
 * 요청 시간 초과는 `secGetDocument`의 타이머가 `controller.abort()`로 끊어 `fetch`가 `AbortError`(또는 `TimeoutError`)
 * `DOMException`으로 거부된다. 이 경로에서 abort를 부르는 것은 그 타이머뿐이라(호출자가 `signal`을 넘기지 않는다) abort는 곧
 * 시간 초과이고, SEC가 느리다는 신호이므로 짧게 다시 그리지 않는다.
 */
function isSecAbortError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
}

/**
 * SEC 한도·과부하 신호 넷: 차단(403·429, `isSecBlockedError`), 슬롯 대기 예산 초과(`SecSlotTimeoutError`), 본문 수신
 * 시간 초과(`SecBodyTimeoutError`), 요청 시간 초과(abort — `isSecAbortError`). 이 사유의 거부는 `headlinesPending`이 아니다.
 */
function isSecContentionError(error: unknown): boolean {
    return (
        isSecBlockedError(error) ||
        error instanceof SecSlotTimeoutError ||
        error instanceof SecBodyTimeoutError ||
        isSecAbortError(error)
    );
}

/** 오류 객체·메시지는 남기지 않는다(DB 오류 메시지에는 바인딩된 값이 들어간다). 이름과 짧은 코드만. */
function logDegrade(step: string, error: unknown): void {
    console.error('[companyFilings]', `${step} failed`, {
        errorName: error instanceof Error ? error.name : 'unknown',
        code: readErrorCode(error),
    });
}

/**
 * 심볼 → CIK. SEC 제출자가 아닌 한국 주식은 심볼 모양만으로, 크립토는 시장 프로필로 가려 `no_sec_filer`를 돌려준다
 * (CIK 조회 없음). 그 밖의 심볼이 CIK 맵에 없으면 "공시 없는 회사"가 아니라 **조회의 구멍**(맵 갱신 지연·유니버스
 * 밖 상장사)이므로 `failed`다 — 모델에게 "이 회사는 공시가 없다"고 말하게 하지 않는다.
 * E2E fake 모드는 DB도 SEC도 건드리지 않는다.
 */
async function lookupCik(symbol: string): Promise<FilerLookup> {
    if (isE2EFakeMode() || isKrEquitySymbol(symbol))
        return { status: 'no_sec_filer' };
    try {
        if ((await resolveMarketProfile(symbol)) !== 'us-equity')
            return { status: 'no_sec_filer' };
        const { db } = getDatabaseClient();
        const cik = await new DrizzleSecFilingsRepository(db).findCikBySymbol(
            symbol.toUpperCase()
        );
        if (cik === null) {
            console.warn(
                '[companyFilings] symbol missing from CIK map',
                symbol
            );
            return { status: 'failed' };
        }
        return { status: 'ok', cik: String(cik) };
    } catch (error) {
        logDegrade('cik lookup', error);
        return { status: 'failed' };
    }
}

/** 창 안의 8-K·8-K/A·6-K 전부(최신순). 읽기 도구는 최신 10건 밖의 접수번호도 받으므로 자르지 않고 캐시한다. */
function loadEventFilings(cik: string): Promise<SubmissionFiling[]> {
    return getOrSetCache<SubmissionFiling[]>(
        `${FILINGS_LIST_CACHE_KEY_PREFIX}:${cik}`,
        FILINGS_LIST_CACHE_TTL_SECONDS,
        async () => {
            const json = await fetchSubmissionsJson(submissionsFileName(cik));
            // 없는 파일·모양이 어긋난 응답을 "공시 없음"으로 캐시하지 않는다.
            if (json === null || !hasRecentFilings(json))
                throw new Error('submissions unavailable');
            return parseSubmissions(json, new Date());
        }
    );
}

/**
 * 한 목록 호출 안의 공시들이 공유하는 상태 — SEC가 막았으면 아직 보내지 않은 요청은 보내지 않는다.
 *
 * 가변 플래그인 이유: 공시별 로드가 병렬로 돌아 "누가 먼저 차단을 봤는가"는 실행 중에만 정해진다. 값으로
 * 넘기면 나머지 로드가 그 사실을 알 수 없어, 차단된 뒤에도 남은 요청을 SEC 게이트에 계속 줄 세운다.
 */
interface SecCallState {
    blocked: boolean;
}

/** 문서 앞부분이 head 상한에 닿아 잘렸는가(= 문서가 읽은 부분보다 길다). */
function hitHeadCap(head: string): boolean {
    return (
        new TextEncoder().encode(head).length >=
        SEC_FILING_HEAD_MAX_BYTES - HEAD_CAP_SLACK_BYTES
    );
}

/**
 * 공시 하나의 읽을 문서·제목·잘라 둔 본문. 색인(`index.json`) 1건 + 문서 앞부분(head, 상한 256KB) 1건으로 만들고,
 * 접수번호 키로 30일 캐시한다 — 목록의 제목 읽기와 본문 읽기가 같은 항목을 쓰므로 한 공시의 head는 두 번 받지 않는다.
 * 전문은 내려받지도 저장하지도 않는다. 본문은 head를 정제하고 표지 찌꺼기를 걷어 `AGENT_FILING_TEXT_MAX_CHARS`로 자른
 * 것이며, head 상한에 닿았거나 잘렸으면 `truncated`다. `totalChars`는 **읽은 앞부분**의 정제 길이다.
 * 어느 단계든 실패하면 던져서 캐시에 남기지 않는다.
 */
function loadFilingDocument(
    cik: string,
    filing: SubmissionFiling,
    state: SecCallState
): Promise<FilingDocument> {
    return getOrSetCache<FilingDocument>(
        `${FILING_TEXT_CACHE_KEY_PREFIX}:${filing.accession}`,
        FILING_CACHE_TTL_SECONDS,
        async () => {
            if (state.blocked) throw new Error('sec blocked');
            try {
                const indexJson = await fetchFilingIndexJson(
                    cik,
                    filing.accession,
                    SEC_TOOL_OPTIONS
                );
                if (indexJson === null)
                    throw new PermanentFilingFailure('index unavailable');
                // 색인을 기다리는 사이 다른 공시가 차단을 겪었으면 문서 요청은 보내지 않는다.
                if (state.blocked) throw new Error('sec blocked');
                const { fileName, document } = pickFilingDocument(
                    indexJson,
                    filing.primaryDocument
                );
                const head = await fetchFilingDocumentHead(
                    cik,
                    filing.accession,
                    fileName,
                    SEC_TOOL_OPTIONS
                );
                if (head === null)
                    throw new PermanentFilingFailure('document unavailable');
                const cleaned = htmlToText(head);
                const text = stripExhibitPreamble(cleaned);
                if (text === '')
                    throw new PermanentFilingFailure('document empty');
                const cut = truncateFilingText(
                    text,
                    AGENT_FILING_TEXT_MAX_CHARS
                );
                // 보도자료가 없는 주 문서의 앞머리는 SEC 표지 문구라 첫 `Item` 본문의 첫 문장(6-K는 첨부 목록 설명, 없으면 표지
                // 안의 설명이나 서명란 뒤 본문)을 쓴다.
                const headline =
                    document === 'press_release'
                        ? extractHeadline(text)
                        : extractPrimaryHeadline(cleaned);
                return {
                    fileName,
                    document,
                    headline,
                    text: cut.text,
                    truncated: cut.truncated || hitHeadCap(head),
                    totalChars: cut.totalChars,
                };
            } catch (error) {
                if (isSecBlockedError(error)) state.blocked = true;
                throw error;
            }
        }
    );
}

/** 목록용 작은 캐시 항목. 빈 칸이면 `loadFilingDocument`가 채우고(본문 항목도 함께 캐시된다) 메타만 따로 저장한다. */
function loadFilingMeta(
    cik: string,
    filing: SubmissionFiling,
    state: SecCallState
): Promise<FilingMeta> {
    return getOrSetCache<FilingMeta>(
        `${FILING_META_CACHE_KEY_PREFIX}:${filing.accession}`,
        FILING_CACHE_TTL_SECONDS,
        async () => {
            try {
                const { fileName, document, headline } =
                    await loadFilingDocument(cik, filing, state);
                return { fileName, document, headline };
            } catch (error) {
                // 접수 직후(`FILING_PUBLICATION_WINDOW_MS` 안)의 "없음"은 아직 게시 전일 수 있어 일시 거부로 둔다.
                if (
                    !(error instanceof PermanentFilingFailure) ||
                    !isPastPublicationWindow(filing.filedAt)
                )
                    throw error;
                // 제목 없는 공시와 같은 취급: 주 문서 URL로 `headline: null`을 30일 캐시한다.
                return {
                    fileName: filing.primaryDocument,
                    document: 'primary',
                    headline: null,
                };
            }
        }
    );
}

function toCompanyFiling(
    cik: string,
    filing: SubmissionFiling,
    meta: FilingMeta | null
): CompanyFiling {
    return {
        accession: filing.accession,
        form: filing.form,
        filedAt: filing.filedAt,
        items: filing.items,
        headline: meta?.headline ?? null,
        hasPressRelease: meta?.document === 'press_release',
        url: `${filingFolderUrl(cik, filing.accession)}/${meta?.fileName ?? filing.primaryDocument}`,
    };
}

/**
 * 미국 상장사의 최근 SEC 현재보고서(8-K·8-K/A·6-K) 목록(최신 `AGENT_FILINGS_LIST_MAX`건, 최근 120일).
 *
 * 절대 던지지 않는다. 제목은 최신 `FILING_META_LOAD_MAX`건만 읽고, 그 밖이거나 읽기에 실패·시간 초과한 공시는
 * `headline: null`로 목록에 남는다. 첫(차가운) 호출은 SEC 요청이 제출 목록 1건 + 공시당 2건 × 6 = 13건이고, 모두
 * `secClient`의 전역 요청 간격을 탄다. 공시별 결과는 캐시되므로 다음 호출은 제출 목록 1건(그것도 30분 캐시)이다.
 */
export async function listCompanyFilings(
    symbol: string
): Promise<ListCompanyFilingsResult> {
    const filer = await lookupCik(symbol);
    if (filer.status !== 'ok') return filer;
    const { cik } = filer;
    const rows = await loadEventFilings(cik).catch((error: unknown) => {
        logDegrade('submissions', error);
        return null;
    });
    if (rows === null) return { status: 'failed' };
    const newest = rows.slice(0, AGENT_FILINGS_LIST_MAX);
    const state: SecCallState = { blocked: false };
    const metas = await Promise.allSettled(
        newest
            .slice(0, FILING_META_LOAD_MAX)
            .map(row => loadFilingMeta(cik, row, state))
    );
    const filings = newest.map((row, index) => {
        const settled = metas[index];
        if (settled === undefined) return toCompanyFiling(cik, row, null);
        if (settled.status === 'rejected') {
            logDegrade('filing meta', settled.reason);
            return toCompanyFiling(cik, row, null);
        }
        return toCompanyFiling(cik, row, settled.value);
    });
    // 차단(`state.blocked`)·한도·시간 초과는 SEC가 과부하라는 신호다 — 이때 호출부가 목록을 짧게 캐시하면 모든 종목이
    // 다시 요청해 한도를 더 넘긴다. 그래서 그 사유는 pending이 아니다(다음 정상 재생성이 다시 시도한다).
    const headlinesPending =
        !state.blocked &&
        metas.some(
            settled =>
                settled.status === 'rejected' &&
                !isSecContentionError(settled.reason)
        );
    return { status: 'ok', filings, headlinesPending };
}

/**
 * 접수번호 하나의 본문(첨부 보도자료 우선, 없으면 주 문서)을 `AGENT_FILING_TEXT_MAX_CHARS`자까지.
 * 접수번호는 최근 120일의 이벤트 공시 **전체** 중 하나여야 한다(목록 상위 10건에 한정하지 않는다) — 아니면
 * `unknown_filing`. 문서의 앞부분(head)만 읽으므로 `totalChars`는 읽은 부분의 길이이고, head가 잘렸으면
 * `truncated`다. 차가운 읽기는 제출 목록 1건 + 색인 1건 + 문서 앞부분 1건(= 3건)이고, 목록 호출이 이미 같은
 * 공시를 읽었다면 캐시로 끝난다. 절대 던지지 않는다.
 */
export async function readCompanyFiling(
    symbol: string,
    accession: string
): Promise<ReadCompanyFilingResult> {
    const filer = await lookupCik(symbol);
    if (filer.status !== 'ok') return filer;
    const { cik } = filer;
    try {
        const rows = await loadEventFilings(cik);
        const row = rows.find(r => r.accession === accession);
        if (row === undefined) return { status: 'unknown_filing' };
        const doc = await loadFilingDocument(cik, row, { blocked: false });
        return {
            status: 'ok',
            filing: {
                ...toCompanyFiling(cik, row, doc),
                document: doc.document,
                text: doc.text,
                truncated: doc.truncated,
                totalChars: doc.totalChars,
            },
        };
    } catch (error) {
        logDegrade('read filing', error);
        return { status: 'failed' };
    }
}
