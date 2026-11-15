import 'server-only';
import { WIKIPEDIA_USER_AGENT } from '@/shared/api/wikipedia/indexConstituents';
import { X_HANDLE_PATTERN } from '@/shared/api/x/xClient';
import { isRecord } from '@/shared/lib/isRecord';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
/** 계정 찾기는 도구의 첫 단계라 짧게 둔다. 실측(2026-11-16, 15종목) 0.3~1.3초. */
const WIKIDATA_REQUEST_TIMEOUT_MS = 3_000;
/**
 * 미국 거래소만 본다 — 같은 티커가 다른 나라 거래소에서 다른 회사를 가리킨다.
 * NYSE(Q13677), NASDAQ(Q82059), NYSE American(Q846626).
 */
const US_EXCHANGE_QIDS = ['Q13677', 'Q82059', 'Q846626'] as const;
/** SPARQL 문자열 리터럴에 그대로 넣으므로 이 모양만 받는다(따옴표·역슬래시·공백 불가). */
const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;
/** 라벨이 없는 항목은 라벨 서비스가 QID를 그대로 돌려준다. */
const BARE_QID = /^Q\d+$/;

interface WikidataExecutive {
    /** 영어 라벨(없으면 다국어 기본 라벨). 둘 다 없으면 `null`. */
    name: string | null;
    handles: string[];
}

interface WikidataStockXAccounts {
    /** 회사 항목에 걸린 X 계정(대표·지원·지역 계정이 섞여 있다 — 고르는 것은 호출부). */
    companyHandles: string[];
    /** 종료일이 없는 CEO 진술의 인물들(공동 CEO면 둘 이상). X 계정이 없는 인물은 `handles: []`. */
    executives: WikidataExecutive[];
}

const EMPTY: WikidataStockXAccounts = { companyHandles: [], executives: [] };
const PREFERRED_RANK = 'http://wikiba.se/ontology#PreferredRank';

/**
 * 과거 값을 뺀다: 종료일(`P582`)이 붙은 진술과 폐기 순위(deprecated) 진술. 남은 진술의 순위(`?cxRank`·`?csRank`)를
 * 함께 받아, 같은 역할에 우선 순위(preferred) 진술이 있으면 그것만 쓴다(새 CEO에 preferred를 달고 전임자의 진술을
 * 종료일 없이 남겨 둔 항목이 흔하다). 회사 항목(`?company`)도 받아 티커가 회사 둘 이상을 가리키면 쓰지 않는다.
 */
function buildQuery(ticker: string): string {
    const exchanges = US_EXCHANGE_QIDS.map(qid => `wd:${qid}`).join(' ');
    const current = (statement: string) =>
        `FILTER NOT EXISTS { ${statement} pq:P582 ?${statement.slice(1)}End } ${statement} wikibase:rank ?${statement.slice(1)}Rank . FILTER(?${statement.slice(1)}Rank != wikibase:DeprecatedRank)`;
    return `SELECT ?company ?companyX ?cxRank ?ceo ?ceoLabel ?csRank ?ceoX ?pxRank WHERE {
  VALUES ?exchange { ${exchanges} }
  ?company p:P414 ?listing .
  ?listing ps:P414 ?exchange ; pq:P249 "${ticker}" .
  ${current('?listing')}
  OPTIONAL { ?company p:P2002 ?cx . ?cx ps:P2002 ?companyX . ${current('?cx')} }
  OPTIONAL {
    ?company p:P169 ?cs . ?cs ps:P169 ?ceo . ${current('?cs')}
    OPTIONAL { ?ceo p:P2002 ?px . ?px ps:P2002 ?ceoX . ${current('?px')} }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
} LIMIT 200`;
}

function bindingValue(row: unknown, key: string): string | null {
    if (!isRecord(row)) return null;
    const cell = row[key];
    const value = isRecord(cell) ? cell.value : undefined;
    return typeof value === 'string' && value !== '' ? value : null;
}

function handleOf(row: unknown, key: string): string | null {
    const value = bindingValue(row, key);
    return value !== null && X_HANDLE_PATTERN.test(value) ? value : null;
}

/** 이 역할의 행 중 우선 순위 진술이 하나라도 있으면 그 행만, 없으면 전부. */
function preferredOnly(rows: readonly unknown[], rankKey: string): unknown[] {
    const preferred = rows.filter(
        row => bindingValue(row, rankKey) === PREFERRED_RANK
    );
    return preferred.length > 0 ? preferred : [...rows];
}

/**
 * 결과 행(회사 계정 × CEO × CEO 계정의 곱)을 계정 묶음으로 접는다. 핸들은 대소문자를 무시하고 한 번만 싣는다.
 * 티커가 회사 항목 둘 이상에 걸려 있으면(상장폐지된 회사의 진술이 종료일 없이 남은 경우) 어느 회사인지 알 수 없으므로
 * 빈 결과다 — 다른 회사의 계정을 이 종목의 공식 계정으로 전하는 것보다 계정이 없다고 답하는 편이 낫다.
 */
function parseStockXAccounts(json: unknown): WikidataStockXAccounts {
    const results = isRecord(json) ? json.results : undefined;
    const bindings = isRecord(results) ? results.bindings : undefined;
    if (!Array.isArray(bindings)) return EMPTY;
    const companies = new Set(
        bindings.flatMap(row => {
            const company = bindingValue(row, 'company');
            return company === null ? [] : [company];
        })
    );
    if (companies.size > 1) return EMPTY;

    const companyHandles = new Map<string, string>();
    for (const row of preferredOnly(
        bindings.filter(row => handleOf(row, 'companyX') !== null),
        'cxRank'
    )) {
        const companyX = handleOf(row, 'companyX');
        if (companyX !== null && !companyHandles.has(companyX.toLowerCase()))
            companyHandles.set(companyX.toLowerCase(), companyX);
    }
    const executiveRows = new Map<string, unknown[]>();
    for (const row of preferredOnly(
        bindings.filter(row => bindingValue(row, 'ceo') !== null),
        'csRank'
    )) {
        const ceo = bindingValue(row, 'ceo');
        if (ceo !== null)
            executiveRows.set(ceo, [...(executiveRows.get(ceo) ?? []), row]);
    }
    const executives = [...executiveRows.values()].map(rows => {
        const label = bindingValue(rows[0], 'ceoLabel');
        const handles = new Map<string, string>();
        // 한 인물의 계정이 여럿이면(부계정) 우선 순위 계정만 쓴다.
        for (const row of preferredOnly(
            rows.filter(row => handleOf(row, 'ceoX') !== null),
            'pxRank'
        )) {
            const ceoX = handleOf(row, 'ceoX');
            if (ceoX !== null && !handles.has(ceoX.toLowerCase()))
                handles.set(ceoX.toLowerCase(), ceoX);
        }
        return {
            name: label !== null && !BARE_QID.test(label) ? label : null,
            handles: [...handles.values()],
        };
    });
    return {
        companyHandles: [...companyHandles.values()],
        executives,
    };
}

/**
 * 미국 상장 티커로 위키데이터에서 회사의 X 계정과 현 CEO의 X 계정을 찾는다. 위키데이터는 누구나 고칠 수 있는
 * 자료다 — 여기서 나온 핸들은 **후보**이고, 실제로 쓸지는 호출부가 X의 팔로워 수로 거른다.
 * 모양이 틀린 티커는 요청 없이 빈 결과, HTTP·파싱 실패는 던진다(빈 결과와 실패를 섞지 않는다 — SERVER.md#SA-18).
 */
export async function fetchStockXAccounts(
    ticker: string
): Promise<WikidataStockXAccounts> {
    if (!TICKER.test(ticker)) return EMPTY;
    const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
    url.searchParams.set('format', 'json');
    url.searchParams.set('query', buildQuery(ticker));
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': WIKIPEDIA_USER_AGENT,
        },
        signal: AbortSignal.timeout(WIKIDATA_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`wikidata responded ${response.status}`);
    }
    const json: unknown = await response.json();
    const results = isRecord(json) ? json.results : undefined;
    if (!isRecord(results) || !Array.isArray(results.bindings))
        throw new Error('wikidata response malformed');
    return parseStockXAccounts(json);
}
