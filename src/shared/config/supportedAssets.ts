/**
 * 사이트가 다루는 자산군의 단일 소스.
 *
 * **왜 상수가 필요한가**: 자산군 커버리지 문구는 SEO 타이틀, 사이트 설명, 키워드,
 * OG alt, 홈 FAQ 답변, HowTo 스키마까지 3개 파일 6곳 이상에 프로즈로 흩어져 있다.
 * 한국 상장 종목을 추가하면서 이 중 일부만 고치는 일이 세 라운드 연속 반복됐고
 * (`docs/workflows/MISTAKES.md` §6.6), 누락된 사본은 "그 자산군은 지원하지 않는다"는
 * 신호를 검색엔진에 계속 보낸다 — 조용하고, 배포로는 드러나지 않는다.
 *
 * **왜 `join()`이 아닌 별칭 목록인가**: 한국어 문장은 자산군 이름을 문맥마다 다르게
 * 쓴다 — 타이틀은 `미국·한국 주식·암호화폐`로 압축하고, FAQ 본문은 `코스피·코스닥
 * 국내 상장 종목`으로 풀어 쓰며, 키워드는 `코스피 종목 분석`처럼 검색어 형태를 쓴다.
 * 배열을 join해 문장을 만들면 셋 다 어색해지므로, 문장은 사람이 쓰고 **모든 문장이
 * 모든 자산군을 언급하는지**를 테스트가 강제한다. 자산군을 하나 추가하면 별칭이
 * 없는 모든 표면에서 테스트가 동시에 깨진다.
 */
export const SUPPORTED_ASSET_TERMS = {
    usEquity: ['미국 주식', '미국·한국 주식', '미국주식'],
    krEquity: [
        '한국 주식',
        '미국·한국 주식',
        '국내 상장 종목',
        '국내 종목',
        '국내 주식',
        '코스피',
        '코스닥',
    ],
    crypto: ['암호화폐', '비트코인', '이더리움', '코인'],
} as const;

export type SupportedAssetId = keyof typeof SUPPORTED_ASSET_TERMS;

export const SUPPORTED_ASSET_IDS = Object.keys(
    SUPPORTED_ASSET_TERMS
) as SupportedAssetId[];

/** 문구가 언급하지 않은 자산군 목록. 빈 배열이면 커버리지가 완전하다. */
export function missingAssetMentions(text: string): SupportedAssetId[] {
    return SUPPORTED_ASSET_IDS.filter(
        id => !SUPPORTED_ASSET_TERMS[id].some(term => text.includes(term))
    );
}
