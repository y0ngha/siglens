import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { OptionsContract, OptionsSnapshot } from '@y0ngha/siglens-core';
import {
    isInTheMoney,
    toClientOptionsSnapshot,
    toCoreOptionsChain,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';

function contract(overrides: Partial<OptionsContract>): OptionsContract {
    return {
        contractSymbol: 'MSFT260117C00400000',
        strike: 400,
        lastPrice: 12.5,
        bid: 12.4,
        ask: 12.6,
        volume: 30,
        openInterest: 400,
        impliedVolatility: 0.31,
        inTheMoney: false,
        ...overrides,
    };
}

const SNAPSHOT: OptionsSnapshot = {
    symbol: 'MSFT',
    underlyingPrice: 410,
    capturedAt: '2026-10-05T20:00:00.000Z',
    chains: [
        {
            expirationDate: '2026-10-17',
            daysToExpiration: 12,
            calls: [
                contract({ strike: 400, inTheMoney: true }),
                contract({ strike: 420, inTheMoney: false }),
            ],
            puts: [
                contract({ strike: 400, inTheMoney: false }),
                contract({ strike: 420, inTheMoney: true }),
            ],
        },
    ],
};

describe('toClientOptionsSnapshot', () => {
    it('계약에서 클라이언트가 읽지 않는 필드(contractSymbol·lastPrice·inTheMoney)를 뺀다', () => {
        const client = toClientOptionsSnapshot(SNAPSHOT);

        expect(client.chains[0]?.calls[0]).toEqual({
            strike: 400,
            bid: 12.4,
            ask: 12.6,
            volume: 30,
            openInterest: 400,
            impliedVolatility: 0.31,
        });
    });

    it('스냅샷·만기 메타데이터는 그대로 둔다', () => {
        const client = toClientOptionsSnapshot(SNAPSHOT);

        expect(client).toMatchObject({
            symbol: 'MSFT',
            underlyingPrice: 410,
            capturedAt: '2026-10-05T20:00:00.000Z',
        });
        expect(client.chains[0]).toMatchObject({
            expirationDate: '2026-10-17',
            daysToExpiration: 12,
        });
    });
});

describe('toCoreOptionsChain', () => {
    it('내가격 여부를 행사가와 현재가로 다시 계산해 원본 플래그와 같게 되돌린다', () => {
        const client = toClientOptionsSnapshot(SNAPSHOT);
        const core = toCoreOptionsChain(client.chains[0]!, 410);

        expect(core.calls.map(c => c.inTheMoney)).toEqual(
            SNAPSHOT.chains[0]!.calls.map(c => c.inTheMoney)
        );
        expect(core.puts.map(p => p.inTheMoney)).toEqual(
            SNAPSHOT.chains[0]!.puts.map(p => p.inTheMoney)
        );
    });

    it('행사가가 현재가와 같으면(등가격) 콜·풋 모두 내가격이 아니다', () => {
        expect(isInTheMoney('call', 410, 410)).toBe(false);
        expect(isInTheMoney('put', 410, 410)).toBe(false);
    });

    it('현재가가 0 이하(시세 없음)면 다시 계산하지 않고 내가격이 아닌 것으로 둔다', () => {
        const client = toClientOptionsSnapshot(SNAPSHOT);
        const core = toCoreOptionsChain(client.chains[0]!, 0);

        expect(
            [...core.calls, ...core.puts].every(c => c.inTheMoney === false)
        ).toBe(true);
        expect(isInTheMoney('put', 400, -1)).toBe(false);
    });

    it('투영으로 남긴 수치 필드는 그대로 보존한다', () => {
        const client = toClientOptionsSnapshot(SNAPSHOT);
        const core = toCoreOptionsChain(client.chains[0]!, 410);

        expect(core.calls[0]).toMatchObject({
            strike: 400,
            bid: 12.4,
            ask: 12.6,
            volume: 30,
            openInterest: 400,
            impliedVolatility: 0.31,
        });
    });
});

/**
 * 투영이 안전한 근거는 "옵션 위젯이 빠진 필드를 읽지 않는다"뿐이다. 누가 위젯에서
 * `lastPrice`나 `contractSymbol`을 쓰기 시작하면 화면에는 빈 값이 조용히 뜬다 —
 * 타입은 `toCoreOptionsChain`이 채운 자리표시값 때문에 통과한다.
 */
describe('옵션 위젯은 클라이언트로 보내지 않는 계약 필드를 읽지 않는다', () => {
    const WIDGET_ROOT = join(process.cwd(), 'src/widgets/options');

    function sourceFiles(dir: string): string[] {
        return readdirSync(dir).flatMap(name => {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) {
                return name === '__tests__' ? [] : sourceFiles(path);
            }
            return /\.(ts|tsx)$/.test(name) ? [path] : [];
        });
    }

    /** 주석은 지운다 — 설명 문장에 필드 이름이 나오는 것은 읽기가 아니다. */
    function withoutComments(source: string): string {
        return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    }

    /**
     * 점 접근만이 아니라 구조 분해(`{ lastPrice }`)·대괄호(`c['lastPrice']`)도 잡도록 식별자
     * 자체가 코드에 나오는지를 본다.
     */
    it.each(['contractSymbol', 'lastPrice', 'inTheMoney'])('%s', field => {
        const readers = sourceFiles(WIDGET_ROOT).filter(path =>
            new RegExp(`\\b${field}\\b`).test(
                withoutComments(readFileSync(path, 'utf8'))
            )
        );
        expect(readers).toEqual([]);
    });

    it('가드가 구조 분해와 대괄호 접근도 잡는다', () => {
        const pattern = /\blastPrice\b/;
        expect(pattern.test(withoutComments('const { lastPrice } = c;'))).toBe(
            true
        );
        expect(pattern.test(withoutComments("c['lastPrice']"))).toBe(true);
        expect(pattern.test(withoutComments('// lastPrice 설명'))).toBe(false);
    });
});
