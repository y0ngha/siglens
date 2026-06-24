import type { CryptoCategory } from '@/shared/lib/types';

// 큐레이션 암호화폐 카테고리 — 홈 '암호화폐 인기 종목' 카드 섹션 전용.
// 심볼은 모두 검증된 POPULAR_CRYPTOS(자동생성) 내에서 선정해 라우트 해석을 보장한다.
// (popular-cryptos.ts는 스크립트가 덮어쓰므로 한글명/그룹은 이 파일에서 수기 관리.)
export const CRYPTO_CATEGORIES: readonly CryptoCategory[] = [
    {
        id: 'major',
        label: '메이저',
        items: [
            { symbol: 'BTCUSD', name: '비트코인' },
            { symbol: 'ETHUSD', name: '이더리움' },
            { symbol: 'XRPUSD', name: '리플' },
            { symbol: 'SOLUSD', name: '솔라나' },
            { symbol: 'BNBUSD', name: '비앤비' },
        ],
    },
    {
        id: 'altcoin',
        label: '알트코인',
        items: [
            { symbol: 'DOGEUSD', name: '도지코인' },
            { symbol: 'ADAUSD', name: '카르다노' },
            { symbol: 'TRXUSD', name: '트론' },
            { symbol: 'LINKUSD', name: '체인링크' },
            { symbol: 'LTCUSD', name: '라이트코인' },
        ],
    },
];
