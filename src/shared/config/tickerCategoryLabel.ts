/**
 * 인기 종목 카테고리 라벨 → 메시지 키.
 *
 * `popular-tickers.ts`는 티커 목록을 담는 **데이터 config**라 라벨 문자열을
 * 그대로 둔다(사이트맵·prewarm이 같은 파일을 읽는다). 표시용 번역만 여기서
 * 갈라낸다 — 예전에는 홈의 섹터 헤더 16개가 네 로케일 전부 한국어였다.
 *
 * 표에 없는 라벨은 원문을 그대로 쓴다. 새 카테고리를 추가하고 여기 등록을
 * 잊으면 화면이 비지 않고 한국어로 보인다 — 테스트가 그걸 잡는다.
 */
export const TICKER_CATEGORY_LABEL_KEY: Record<string, string> = {
    메가캡·지수: 'tickerCategory.Megacapsindices',
    AI·반도체: 'tickerCategory.AIsemiconductors',
    소프트웨어·클라우드: 'tickerCategory.Softwarecloud',
    핀테크·크립토: 'tickerCategory.Fintechcrypto',
    '레버리지 ETF': 'tickerCategory.LeveragedETFs',
    헬스케어·바이오: 'tickerCategory.Healthcarebiotech',
    양자컴퓨팅: 'tickerCategory.Quantumcomputing',
    우주·항공우주: 'tickerCategory.Spaceaerospace',
    EV·모빌리티: 'tickerCategory.EVmobility',
    에너지·산업재: 'tickerCategory.Energyindustrials',
    반도체·IT: 'tickerCategory.SemiconductorsIT',
    자동차·2차전지: 'tickerCategory.Autosbatteries',
    바이오·헬스케어: 'tickerCategory.Biotechhealthcare',
    인터넷·플랫폼: 'tickerCategory.Internetplatforms',
    금융·지주: 'tickerCategory.Financialsholdings',
    코스닥: 'tickerCategory.KOSDAQ',
};

/**
 * 같은 카테고리 라벨 → **한 줄 설명** 메시지 키.
 *
 * 홈 카드가 티커 칩만 나열하면 크롤러가 받는 것은 링크 묶음뿐이다(2026-09 구글
 * 정책 감사 L20 — 홈의 산문 비율). 카테고리가 무엇을 묶은 것인지 한 문장으로
 * 말한다. 라벨 맵과 키 이름을 맞춰 두면 둘 중 하나만 추가하는 실수가 눈에 띈다.
 *
 * 표에 없는 라벨은 설명을 렌더하지 않는다(카드가 비지 않는다).
 */
export const TICKER_CATEGORY_DESCRIPTION_KEY: Record<string, string> = {
    메가캡·지수: 'categoryDescription.Megacapsindices',
    AI·반도체: 'categoryDescription.AIsemiconductors',
    소프트웨어·클라우드: 'categoryDescription.Softwarecloud',
    핀테크·크립토: 'categoryDescription.Fintechcrypto',
    '레버리지 ETF': 'categoryDescription.LeveragedETFs',
    헬스케어·바이오: 'categoryDescription.Healthcarebiotech',
    양자컴퓨팅: 'categoryDescription.Quantumcomputing',
    우주·항공우주: 'categoryDescription.Spaceaerospace',
    EV·모빌리티: 'categoryDescription.EVmobility',
    에너지·산업재: 'categoryDescription.Energyindustrials',
    반도체·IT: 'categoryDescription.SemiconductorsIT',
    자동차·2차전지: 'categoryDescription.Autosbatteries',
    바이오·헬스케어: 'categoryDescription.Biotechhealthcare',
    인터넷·플랫폼: 'categoryDescription.Internetplatforms',
    금융·지주: 'categoryDescription.Financialsholdings',
    코스닥: 'categoryDescription.KOSDAQ',
    메이저: 'categoryDescription.Major',
    알트코인: 'categoryDescription.Altcoins',
};
