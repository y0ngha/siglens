/**
 * Technical/Overall 스냅샷 프로즈 상단에 반복되는 라이브 분석 패널 상호참조
 * 문장의 **키**(`shared.ui.misc`). 문자열이 아니다 — 예전엔 한국어 리터럴이라
 * `/en/AAPL`의 스냅샷 프로즈가 영어 본문 위에 한국어 안내를 렌더했다.
 *
 * 이 두 탭은 라이브 AI 분석 패널과 이 과거 스냅샷이 같은 화면에 놓인다.
 * 급변동일에는 두 값이 크게 어긋나므로(관측: 라이브 $308.91/RSI 43.2 vs
 * 스냅샷 $333.43/RSI 61.66), 어느 쪽이 실시간인지 본문에서도 한 번 더 못박는다.
 *
 * A5(감사): 이 문장과 위 근거 코멘트가 `TechnicalSnapshotProse.tsx`/
 * `OverallSnapshotProse.tsx`와 각각의 테스트 파일까지 4곳에 그대로
 * 복사돼 있었다 — 문구를 바꿀 때 네 곳을 전부 찾아 고쳐야 하고, 하나라도
 * 놓치면 두 탭의 문구가 어긋난다. 여기서 단일 소스로 export하고, 소비하는
 * 쪽에는 이 상수만 import해서 쓴다(근거 코멘트는 여기 하나만 남긴다).
 */
export const LIVE_ANALYSIS_CROSS_REF_KEY = 'liveCrossRef';
