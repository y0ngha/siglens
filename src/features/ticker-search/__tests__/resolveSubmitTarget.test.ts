import { describe, expect, it } from 'vitest';

import {
    resolveSubmitTarget,
    resolveTypedTarget,
} from '@/features/ticker-search/lib/resolveSubmitTarget';
import type { TickerSearchResult } from '@/shared/lib/types';

function result(
    symbol: string,
    name: string,
    koreanName?: string
): TickerSearchResult {
    return {
        symbol,
        name,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
        ...(koreanName ? { koreanName } : {}),
    };
}

/**
 * 검색 키의 목적지 규칙. 오버레이와 데스크톱 자동완성이 이 함수 하나를 공유하므로,
 * 규칙이 흔들리면 두 표면이 함께 흔들린다.
 */
describe('resolveSubmitTarget', () => {
    it('친 티커와 정확히 일치하는 결과를 첫 결과보다 우선한다', () => {
        // 랭킹이 그 종목을 1위로 올리지 못했더라도, 티커를 정확히 아는 사용자의
        // 의도가 랭킹보다 분명하다.
        const target = resolveSubmitTarget('nvda', [
            result('NVDX', 'T-REX 2X Long NVIDIA'),
            result('NVDA', 'NVIDIA Corporation', '엔비디아'),
        ]);
        expect(target).toEqual({ symbol: 'NVDA', label: '엔비디아' });
    });

    it('정확 일치가 없으면 첫 결과로 간다', () => {
        // `appl`을 치고 검색 키를 눌렀을 때 `/APPL`(404)이 아니라 AAPL로 가야 한다.
        const target = resolveSubmitTarget('appl', [
            result('AAPL', 'Apple Inc.', '애플'),
        ]);
        expect(target).toEqual({ symbol: 'AAPL', label: '애플' });
    });

    it('결과가 없으면 친 문자열을 대문자 티커로 삼는다', () => {
        // FMP가 색인하지 않는 종목에 닿는 유일한 경로다.
        expect(resolveSubmitTarget('brk.b', [])).toEqual({
            symbol: 'BRK.B',
            label: 'BRK.B',
        });
    });

    it('결과가 없고 티커 형태도 아니면 아무 데도 보내지 않는다', () => {
        // 친 문자열이 그대로 URL이 된다 — 회사명은 없는 페이지로, `../`는 엉뚱한
        // 라우트로 간다.
        expect(resolveSubmitTarget('삼성전자', [])).toBeNull();
        expect(resolveSubmitTarget('../admin', [])).toBeNull();
        expect(resolveSubmitTarget('   ', [])).toBeNull();
        // 12자를 넘는 문자열은 티커가 아니다.
        expect(resolveSubmitTarget('ABCDEFGHIJKLM', [])).toBeNull();
    });
});

/**
 * 폼 모드(`navigateOnSelect: false`)의 목적지 규칙. 이동이 아니라 값 확정이라
 * `resolveSubmitTarget`과 달리 결과 우선·티커 형태 검사를 걸지 않는다.
 */
describe('resolveTypedTarget', () => {
    describe('when the query is non-empty', () => {
        it('친 문자열을 대문자로 바꿔 그대로 목적지로 삼는다', () => {
            expect(resolveTypedTarget('appl')).toEqual({
                symbol: 'APPL',
                label: 'APPL',
            });
        });

        it('티커 형태가 아니어도(회사명·경로 등) 그대로 통과시킨다', () => {
            // 폼 모드는 값 확정일 뿐 페이지 이동이 아니므로, 티커 형태 검사가 없다.
            expect(resolveTypedTarget('삼성전자')).toEqual({
                symbol: '삼성전자',
                label: '삼성전자',
            });
        });

        it('앞뒤 공백을 제거한다', () => {
            expect(resolveTypedTarget('  nvda  ')).toEqual({
                symbol: 'NVDA',
                label: 'NVDA',
            });
        });
    });

    describe('when the query is empty', () => {
        it('빈 문자열이면 null을 반환한다', () => {
            expect(resolveTypedTarget('')).toBeNull();
        });

        it('공백만 있으면 null을 반환한다', () => {
            expect(resolveTypedTarget('   ')).toBeNull();
        });
    });
});
