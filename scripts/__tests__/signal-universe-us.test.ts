import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    buildUsSnapshot,
    dropSecondShareClasses,
    issuerOf,
    parseSecurityNames,
    renderUsSnapshotFile,
} from '../signal-universe/usSp500Source';

/** Symbol·Security 두 열짜리 Wikipedia 표 조각. */
function tableOf(rows: readonly (readonly [string, string])[]): string {
    const body = rows
        .map(
            ([symbol, name]) =>
                `<tr><td><a>${symbol}</a></td><td>${name}</td></tr>`
        )
        .join('');
    return `<table class="wikitable"><tr><th>Symbol</th><th>Security</th></tr>${body}</table>`;
}

/** 개수 가드(495~510)를 넘기려고 만든 서로 다른 발행사 행. */
const FILLER = Array.from(
    { length: 497 },
    (_, i): readonly [string, string] => [`T${i}`, `Company ${i}`]
);
const SHARE_CLASSES: readonly (readonly [string, string])[] = [
    ['GOOGL', 'Alphabet Inc. (Class A)'],
    ['GOOG', 'Alphabet Inc. (Class C)'],
    ['FOXA', 'Fox Corporation (Class A)'],
    ['FOX', 'Fox Corporation (Class B)'],
    ['NWSA', 'News Corp (Class A)'],
    ['NWS', 'News Corp (Class B)'],
    ['BRK.B', 'Berkshire Hathaway'],
];

describe('parseSecurityNames', () => {
    it('심볼과 회사명을 읽고 `&amp;`를 푼다', () => {
        const names = parseSecurityNames(
            tableOf([
                ['AAPL', 'Apple Inc.'],
                ['JNJ', 'Johnson &amp; Johnson'],
            ])
        );
        expect(names.get('AAPL')).toBe('Apple Inc.');
        expect(names.get('JNJ')).toBe('Johnson & Johnson');
    });

    it('Security 열이 없는 표는 건너뛴다', () => {
        const html =
            '<table><tr><th>Symbol</th></tr><tr><td>A</td></tr></table>';
        expect(parseSecurityNames(html).size).toBe(0);
    });
});

describe('issuerOf', () => {
    it('클래스 표기를 뗀다', () => {
        expect(issuerOf('Alphabet Inc. (Class A)')).toBe('Alphabet Inc.');
        expect(issuerOf('Berkshire Hathaway')).toBe('Berkshire Hathaway');
    });
});

describe('dropSecondShareClasses', () => {
    const names = new Map(SHARE_CLASSES);

    it('정해 둔 한 종류만 남기고 정렬한다', () => {
        expect(
            dropSecondShareClasses(
                ['NWS', 'GOOG', 'GOOGL', 'FOX', 'FOXA', 'NWSA', 'BRK.B'],
                names
            )
        ).toEqual(['BRK.B', 'FOXA', 'GOOGL', 'NWSA']);
    });

    it('규칙에 없는 중복 발행사는 던진다', () => {
        const unknown = new Map([
            ['XA', 'Foo Inc. (Class A)'],
            ['XB', 'Foo Inc. (Class B)'],
        ]);
        expect(() => dropSecondShareClasses(['XA', 'XB'], unknown)).toThrow(
            /duplicate issuer "Foo Inc."/
        );
    });

    it('남기기로 한 심볼이 목록에 없으면 던진다', () => {
        const withoutKeeper = new Map([
            ['GOOG', 'Alphabet Inc. (Class C)'],
            ['GOOGB', 'Alphabet Inc. (Class B)'],
        ]);
        expect(() =>
            dropSecondShareClasses(['GOOG', 'GOOGB'], withoutKeeper)
        ).toThrow(/no keep rule/);
    });

    it('회사명을 모르는 심볼은 던진다', () => {
        expect(() => dropSecondShareClasses(['ZZZ'], new Map())).toThrow(
            /no Security name for symbol ZZZ/
        );
    });
});

describe('buildUsSnapshot', () => {
    it('개수 가드를 지나면 중복 발행사를 정리한 심볼 목록을 만든다', () => {
        const snapshot = buildUsSnapshot(
            tableOf([...FILLER, ...SHARE_CLASSES]),
            '2026-11-22'
        );
        expect(snapshot.asOf).toBe('2026-11-22');
        expect(snapshot.symbols).toHaveLength(497 + 4);
        expect(snapshot.symbols).toContain('GOOGL');
        expect(snapshot.symbols).not.toContain('GOOG');
    });

    it('개수가 범위를 벗어나면 던진다', () => {
        expect(() =>
            buildUsSnapshot(tableOf(SHARE_CLASSES), '2026-11-22')
        ).toThrow(/count/);
    });
});

describe('renderUsSnapshotFile', () => {
    it('출처·기준일·개수를 머리말에 남기고 심볼을 나열한다', () => {
        const file = renderUsSnapshotFile(
            { asOf: '2026-11-22', symbols: ['AAPL', 'MSFT'] },
            'yarn signal-universe:us'
        );
        expect(file).toContain('기준일 2026-11-22, 2종목');
        expect(file).toContain("asOf: '2026-11-22'");
        expect(file).toContain("'AAPL',");
        expect(file).toContain("source: 'wikipedia:List_of_S&P_500_companies'");
    });
});
