import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    assertConstituentCount,
    fetchIndexConstituents,
    IndexConstituentsError,
    INDEX_SOURCES,
    normalizeIndexSymbol,
    parseConstituentSymbols,
    WIKIPEDIA_REQUEST_TIMEOUT_MS,
    WIKIPEDIA_USER_AGENT,
} from '../indexConstituents';

/** 2026-10-24 실제 Wikipedia 표에서 머리글과 몇 행만 남긴 조각(속성 id·data-mw는 제거). */
const fixture = (name: string): string =>
    readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

/** 머리글 `Symbol` 열 하나짜리 표를 n행으로 만든다. */
function tableOf(symbols: readonly string[]): string {
    const rows = symbols.map(s => `<tr><td>${s}</td></tr>`).join('');
    return `<table class="wikitable"><tr><th>Symbol</th></tr>${rows}</table>`;
}
const syms = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `S${i}`);

afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockClear();
});

describe('parseConstituentSymbols', () => {
    it('S&P 500 표: 링크 안 심볼을 읽고 주석이 낀 BRK.B·BF.B를 점 표기로 낸다', () => {
        expect(
            parseConstituentSymbols(
                fixture('sp500.html'),
                INDEX_SOURCES.sp500.symbolHeaders
            )
        ).toEqual(['MMM', 'AOS', 'BRK.B', 'BF.B']);
    });

    it('Nasdaq-100 표: Ticker 열만 읽고 GOOG·GOOGL을 별개 종목으로 둔다', () => {
        expect(
            parseConstituentSymbols(
                fixture('nasdaq100.html'),
                INDEX_SOURCES.nasdaq100.symbolHeaders
            )
        ).toEqual(['ADBE', 'AMD', 'GOOGL', 'GOOG']);
    });

    it('Dow 표: 첫 열이 th(회사명)여도 Symbol 열을 머리글 이름으로 찾는다', () => {
        expect(
            parseConstituentSymbols(
                fixture('dowJones.html'),
                INDEX_SOURCES.dowJones.symbolHeaders
            )
        ).toEqual(['MMM', 'GOOGL', 'AXP', 'AMGN']);
    });

    it('중복은 한 번만 낸다', () => {
        expect(
            parseConstituentSymbols(tableOf(['AAPL', 'AAPL', 'MSFT']), [
                'Symbol',
            ])
        ).toEqual(['AAPL', 'MSFT']);
    });

    it('심볼 열이 있는 표가 없으면 던진다', () => {
        expect(() =>
            parseConstituentSymbols('<table><tr><th>Year</th></tr></table>', [
                'Symbol',
            ])
        ).toThrow(IndexConstituentsError);
        expect(() =>
            parseConstituentSymbols('<p>no table</p>', ['Symbol'])
        ).toThrow(IndexConstituentsError);
    });

    it('심볼 모양이 아닌 셀이 섞이면 던진다(표 구조 변경)', () => {
        expect(() =>
            parseConstituentSymbols(tableOf(['AAPL', 'Apple Inc.']), ['Symbol'])
        ).toThrow(IndexConstituentsError);
    });
});

describe('parseConstituentSymbols - 표 선택과 구조 가드', () => {
    it('같은 머리글을 쓰는 작은 변동 표가 앞에 있어도 심볼이 가장 많은 본표를 고른다', () => {
        const changes = tableOf(['NEW1', 'OLD1']);
        const html = `${changes}${tableOf(['AAPL', 'MSFT', 'EXC'])}`;
        expect(parseConstituentSymbols(html, ['Symbol'])).toEqual([
            'AAPL',
            'MSFT',
            'EXC',
        ]);
    });

    it('심볼 모양이 아닌 셀뿐인 같은 머리글 표는 건너뛰고 본표를 쓴다', () => {
        const prose = tableOf(['See the note below']);
        const html = `${prose}${tableOf(['AAPL', 'MSFT'])}`;
        expect(parseConstituentSymbols(html, ['Symbol'])).toEqual([
            'AAPL',
            'MSFT',
        ]);
    });

    it('구조가 어긋난(rowspan) 후보 표가 앞에 있어도 뒤의 유효한 표의 심볼을 쓴다', () => {
        const broken =
            '<table><tr><th>Symbol</th><th>Sector</th></tr>' +
            '<tr><td>BAD1</td><td rowspan="2">Tech</td></tr>' +
            '<tr><td>BAD2</td></tr></table>';
        const html = `${broken}${tableOf(['AAPL', 'MSFT'])}`;
        expect(parseConstituentSymbols(html, ['Symbol'])).toEqual([
            'AAPL',
            'MSFT',
        ]);
    });

    it('rowspan 때문에 셀 수가 머리글과 다른 행이 있으면 던진다', () => {
        const html =
            '<table><tr><th>Symbol</th><th>Sector</th></tr>' +
            '<tr><td>AAPL</td><td rowspan="2">Tech</td></tr>' +
            '<tr><td>MSFT</td></tr></table>';
        expect(() => parseConstituentSymbols(html, ['Symbol'])).toThrow(
            /cell count/
        );
    });
});

/**
 * 실제 행 모양(`fixtures/*.html`의 첫 데이터 행)을 템플릿으로 n행짜리 전체 크기 표를 만든다. 전체 표를
 * 그대로 커밋하지 않고도 개수 범위 가드가 실제 마크업에서 동작하는지 고정한다.
 */
function fullSizeTable(fixtureName: string, count: number): string {
    const html = fixture(fixtureName);
    const rows = html.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
    const [header, template] = rows;
    if (header === undefined || template === undefined)
        throw new Error('fixture has no rows');
    const sample = parseConstituentSymbols(html, ['Symbol', 'Ticker'])[0] ?? '';
    const body = Array.from({ length: count }, (_, i) =>
        template.replace(`>${sample}<`, `>T${i}<`)
    );
    return `<table class="wikitable">${header}${body.join('')}</table>`;
}

describe('전체 크기 표', () => {
    it.each([
        ['sp500', 'sp500.html', 503, true],
        ['sp500', 'sp500.html', 100, false],
        ['nasdaq100', 'nasdaq100.html', 101, true],
        ['nasdaq100', 'nasdaq100.html', 50, false],
    ] as const)('%s %i행 -> 통과 %s', (index, file, n, ok) => {
        const symbols = parseConstituentSymbols(
            fullSizeTable(file, n),
            INDEX_SOURCES[index].symbolHeaders
        );
        expect(symbols).toHaveLength(n);
        const run = () => assertConstituentCount(index, symbols);
        if (ok) expect(run).not.toThrow();
        else expect(run).toThrow(IndexConstituentsError);
    });

    it('Dow 전체 표(실제 30행)는 개수 범위를 통과한다', () => {
        const symbols = parseConstituentSymbols(
            fixture('dowJones.full.html'),
            INDEX_SOURCES.dowJones.symbolHeaders
        );
        expect(() => assertConstituentCount('dowJones', symbols)).not.toThrow();
    });
});

describe('normalizeIndexSymbol', () => {
    it.each([
        ['BRK.B', 'BRK.B'],
        ['BRK-B', 'BRK.B'],
        ['brk/b', 'BRK.B'],
        [' goog ', 'GOOG'],
    ])('%s -> %s', (raw, expected) => {
        expect(normalizeIndexSymbol(raw)).toBe(expected);
    });
});

describe('assertConstituentCount', () => {
    it.each([
        ['sp500', 494, false],
        ['sp500', 495, true],
        ['sp500', 510, true],
        ['sp500', 511, false],
        ['nasdaq100', 97, false],
        ['nasdaq100', 98, true],
        ['nasdaq100', 104, true],
        ['nasdaq100', 105, false],
        ['dowJones', 29, false],
        ['dowJones', 30, true],
        ['dowJones', 31, false],
    ] as const)('%s %i개 -> 통과 %s', (index, n, ok) => {
        const run = () => assertConstituentCount(index, syms(n));
        if (ok) expect(run).not.toThrow();
        else expect(run).toThrow(IndexConstituentsError);
    });
});

describe('fetchIndexConstituents', () => {
    it('User-Agent를 달아 해당 지수 문서를 읽고 심볼을 낸다', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(tableOf(syms(30)), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchSpy);
        const out = await fetchIndexConstituents('dowJones');
        expect(out).toHaveLength(30);
        const [url, init] = fetchSpy.mock.calls[0] ?? [];
        expect(url).toBe(INDEX_SOURCES.dowJones.url);
        expect((init?.headers as Record<string, string>)['User-Agent']).toBe(
            WIKIPEDIA_USER_AGENT
        );
    });

    it('요청에 AbortSignal을 달고 3초 타임아웃을 건다', async () => {
        const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
        fetchSpy.mockResolvedValueOnce(
            new Response(tableOf(syms(30)), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchSpy);
        await fetchIndexConstituents('dowJones');
        const [, init] = fetchSpy.mock.calls[0] ?? [];
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(timeoutSpy).toHaveBeenCalledWith(WIKIPEDIA_REQUEST_TIMEOUT_MS);
        expect(WIKIPEDIA_REQUEST_TIMEOUT_MS).toBe(3_000);
        timeoutSpy.mockRestore();
    });

    it('개수가 범위 밖이면 던진다(캐시되지 않게)', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(tableOf(syms(12)), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchSpy);
        await expect(fetchIndexConstituents('sp500')).rejects.toThrow(
            /outside/
        );
    });

    it('HTTP 오류는 던진다', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('x', { status: 429 }));
        vi.stubGlobal('fetch', fetchSpy);
        await expect(fetchIndexConstituents('nasdaq100')).rejects.toThrow(
            /429/
        );
    });
});
