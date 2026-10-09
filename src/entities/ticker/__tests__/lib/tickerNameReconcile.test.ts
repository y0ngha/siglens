import {
    GUARD_SAMPLE_SIZE,
    RENAME_BATCH_MAX,
    RENAME_GUARD_FLOOR,
    RENAME_GUARD_RATIO,
    planTickerNameReconcile,
    type TickerNameReconcileInput,
} from '../../lib/tickerNameReconcile';

const isKr = (symbol: string): boolean => /\.(KS|KQ)$/.test(symbol);

function makeInput(
    overrides: Partial<TickerNameReconcileInput> = {}
): TickerNameReconcileInput {
    return {
        listed: [],
        koreanTickerRows: [],
        assetTranslationRows: [],
        canonicalSymbols: new Set(),
        isKrEquitySymbol: isKr,
        ...overrides,
    };
}

/**
 * `n`개의 서로 다른 회사로 재할당된 심볼에 이름이 그대로인 심볼 `unchanged`개를 더한 입력을
 * 만든다. 기본 `unchanged`는 가드(비교 대상의 `RENAME_GUARD_RATIO`)에 걸리지 않을 만큼이다.
 */
function makeRenamedInput(
    n: number,
    unchanged = Math.ceil(n / RENAME_GUARD_RATIO)
): TickerNameReconcileInput {
    const symbols = Array.from(
        { length: n },
        (_, i) => `S${String(i).padStart(4, '0')}`
    );
    const stable = Array.from(
        { length: unchanged },
        (_, i) => `U${String(i).padStart(5, '0')}`
    );
    return makeInput({
        listed: [
            ...symbols.map(symbol => ({
                symbol,
                companyName: `New ${symbol} Co`,
            })),
            ...stable.map(symbol => ({
                symbol,
                companyName: `${symbol} Inc.`,
            })),
        ],
        koreanTickerRows: [
            ...symbols.map(symbol => ({
                symbol,
                name: `Old ${symbol} Industries`,
            })),
            ...stable.map(symbol => ({ symbol, name: `${symbol} Inc` })),
        ],
    });
}

describe('planTickerNameReconcile — 후보 추출', () => {
    it('정규화 후에도 이름이 다른 심볼만 후보로 뽑는다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [
                    { symbol: 'AAPL', companyName: 'Apple Inc.' },
                    { symbol: 'LAZR', companyName: 'Luminar Technologies' },
                ],
                koreanTickerRows: [
                    { symbol: 'AAPL', name: 'APPLE INC' }, // 표기만 다름
                    { symbol: 'LAZR', name: 'Old Lidar Corp' }, // 재할당
                ],
            })
        );

        expect(plan.candidates).toEqual([
            {
                symbol: 'LAZR',
                oldName: 'Old Lidar Corp',
                newName: 'Luminar Technologies',
            },
        ]);
        expect(plan.compared).toBe(2);
        expect(plan.guardTrip).toBeNull();
    });

    it('두 테이블 중 한쪽만 어긋나도 후보이며, 같은 심볼은 한 번만 나온다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'XYZ', companyName: 'New Name Corp' }],
                koreanTickerRows: [{ symbol: 'XYZ', name: 'Old Name Corp' }],
                assetTranslationRows: [
                    { symbol: 'XYZ', name: 'Old Name Corp' },
                ],
            })
        );

        expect(plan.candidates).toHaveLength(1);
        expect(plan.candidates[0].oldName).toBe('Old Name Corp');
        expect(plan.compared).toBe(1);
    });

    it('korean_tickers는 맞고 asset_translations만 어긋나도 후보다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'XYZ', companyName: 'New Name Corp' }],
                koreanTickerRows: [{ symbol: 'XYZ', name: 'New Name Corp.' }],
                assetTranslationRows: [
                    { symbol: 'XYZ', name: 'Stale Name Corp' },
                ],
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['XYZ']);
        expect(plan.candidates[0].oldName).toBe('Stale Name Corp');
    });

    it('국내 심볼은 stock-list에 있어도 제외한다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: '005930.KS', companyName: 'Different' }],
                koreanTickerRows: [
                    { symbol: '005930.KS', name: 'Samsung Electronics' },
                ],
            })
        );

        expect(plan.candidates).toEqual([]);
        expect(plan.compared).toBe(0);
    });

    it('stock-list에 없는 심볼은 건너뛴다 (상폐·지수·크립토)', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'AAPL', companyName: 'Apple Inc.' }],
                koreanTickerRows: [{ symbol: '^GSPC', name: 'S&P 500' }],
                assetTranslationRows: [{ symbol: 'GONE', name: 'Gone Corp' }],
            })
        );

        expect(plan.candidates).toEqual([]);
        expect(plan.compared).toBe(0);
    });

    it('별칭 맵에 없는 dual-class 심볼(HEI.A)도 하이픈 표기로 대조한다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'HEI-A', companyName: 'HEICO Reborn' }],
                koreanTickerRows: [{ symbol: 'HEI.A', name: 'HEICO Old' }],
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['HEI.A']);
    });

    it('행이 fmpKey를 주면 그 키로 stock-list를 찾는다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'BRK-B', companyName: 'Berkshire Reborn' }],
                assetTranslationRows: [
                    { symbol: 'BRK.B', name: 'Old', fmpKey: 'BRK-B' },
                ],
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['BRK.B']);
    });

    it('앱 표기(BRK.B)를 FMP 표기(BRK-B)로 바꿔 대조한다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [{ symbol: 'BRK-B', companyName: 'Berkshire New' }],
                koreanTickerRows: [{ symbol: 'BRK.B', name: 'Berkshire Old' }],
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['BRK.B']);
    });
});

describe('planTickerNameReconcile — 정본 심볼', () => {
    it('정본 심볼은 처리 후보가 아니라 검토 목록으로만 나온다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [
                    { symbol: 'LAES', companyName: 'Reassigned Co' },
                    { symbol: 'XYZ', companyName: 'New Name Corp' },
                ],
                koreanTickerRows: [
                    { symbol: 'LAES', name: 'SEALSQ Corp' },
                    { symbol: 'XYZ', name: 'Old Name Corp' },
                ],
                canonicalSymbols: new Set(['LAES']),
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['XYZ']);
        expect(plan.canonicalRenamed).toEqual([
            {
                symbol: 'LAES',
                oldName: 'SEALSQ Corp',
                newName: 'Reassigned Co',
            },
        ]);
    });
});

describe('planTickerNameReconcile — 가드와 배치 상한', () => {
    it('후보가 비교 대상의 가드 비율을 넘으면 통째로 건너뛰고 샘플만 남긴다', () => {
        // 비교 4,000건 중 후보 401건 — 10%(400)와 하한(300)을 모두 넘는다.
        const plan = planTickerNameReconcile(makeRenamedInput(401, 3599));

        expect(plan.guardTrip).toBe('401 candidates');
        expect(plan.candidates).toEqual([]);
        expect(plan.canonicalRenamed).toEqual([]);
        expect(plan.deferred).toBe(0);
        expect(plan.guardSample).toHaveLength(GUARD_SAMPLE_SIZE);
        expect(plan.guardSample[0].symbol).toBe('S0000');
    });

    it('후보가 가드 비율과 같으면 가드가 걸리지 않는다', () => {
        // 비교 4,000건 중 후보 400건 — 정확히 10%.
        const plan = planTickerNameReconcile(makeRenamedInput(400, 3600));

        expect(plan.guardTrip).toBeNull();
        expect(plan.candidates).toHaveLength(RENAME_BATCH_MAX);
    });

    it('비교 대상이 작으면 하한까지는 비율과 무관하게 처리하고, 넘으면 건너뛴다', () => {
        expect(
            planTickerNameReconcile(makeRenamedInput(RENAME_GUARD_FLOOR, 0))
                .guardTrip
        ).toBeNull();
        expect(
            planTickerNameReconcile(makeRenamedInput(RENAME_GUARD_FLOOR + 1, 0))
                .guardTrip
        ).toBe(`${RENAME_GUARD_FLOOR + 1} candidates`);
    });

    it('첫 회차 같은 누적분(비교 대상의 ~5%)은 가드에 걸리지 않고 배치 상한만큼 소진한다', () => {
        // 운영 첫 회차: 비교 30,827건 중 후보 1,503건(4.9%)이 예전 고정 상한(300)에 걸렸다.
        const plan = planTickerNameReconcile(makeRenamedInput(1503, 29324));

        expect(plan.guardTrip).toBeNull();
        expect(plan.candidates).toHaveLength(RENAME_BATCH_MAX);
        expect(plan.deferred).toBe(1503 - RENAME_BATCH_MAX);
    });

    it('배치 상한 이내면 이월이 없다', () => {
        const plan = planTickerNameReconcile(
            makeRenamedInput(RENAME_BATCH_MAX)
        );

        expect(plan.candidates).toHaveLength(RENAME_BATCH_MAX);
        expect(plan.deferred).toBe(0);
    });

    it('이월분은 다음 날 이어진다 — 처리된 앞쪽이 빠지면 뒤쪽이 나온다', () => {
        const total = RENAME_BATCH_MAX + 5;
        const first = planTickerNameReconcile(makeRenamedInput(total));
        const processed = new Set(first.candidates.map(c => c.symbol));

        // 처리된 심볼은 저장 이름이 FMP와 같아져 후보에서 빠진다.
        const input = makeRenamedInput(total);
        const next = planTickerNameReconcile({
            ...input,
            koreanTickerRows: input.koreanTickerRows.map(row => {
                const listedName = input.listed.find(
                    e => e.symbol === row.symbol
                )?.companyName;
                return processed.has(row.symbol) && listedName
                    ? { ...row, name: listedName }
                    : row;
            }),
        });

        expect(first.deferred).toBe(5);
        expect(next.candidates).toHaveLength(5);
        expect(next.deferred).toBe(0);
        expect(next.candidates.every(c => !processed.has(c.symbol))).toBe(true);
    });

    it('정본 후보는 처리 몫(배치 상한)을 차지하지 않는다', () => {
        const input = makeRenamedInput(RENAME_BATCH_MAX);
        const plan = planTickerNameReconcile({
            ...input,
            canonicalSymbols: new Set(['S0000']),
        });

        expect(plan.candidates).toHaveLength(RENAME_BATCH_MAX - 1);
        expect(plan.canonicalRenamed.map(c => c.symbol)).toEqual(['S0000']);
        expect(plan.deferred).toBe(0);
    });
});

describe('planTickerNameReconcile — 처리 순서', () => {
    it('이름이 많이 다른 후보(다른 회사로 넘어간 심볼)를 표기 차이보다 먼저 처리한다', () => {
        const plan = planTickerNameReconcile(
            makeInput({
                listed: [
                    { symbol: 'AAAX', companyName: 'MFS Research Fund;Y' },
                    { symbol: 'ZZZ', companyName: 'Full Alliance Group, Inc.' },
                ],
                koreanTickerRows: [
                    { symbol: 'AAAX', name: 'MFS Research Fund Class A' },
                    {
                        symbol: 'ZZZ',
                        name: 'Fidelity Capital and Income Fund',
                    },
                ],
            })
        );

        expect(plan.candidates.map(c => c.symbol)).toEqual(['ZZZ', 'AAAX']);
    });
});
