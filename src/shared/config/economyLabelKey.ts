/**
 * 경제 지표·카테고리 라벨 → 메시지 키.
 *
 * `economyIndicators*.ts`는 FMP/한국은행 시리즈 ID와 표시 메타를 함께 담는
 * **데이터 config**라 라벨 문자열을 그대로 둔다. 표시용 번역만 여기서 갈라낸다 —
 * `/en/economy`가 `연방기금금리`·`금리`를 그대로 렌더하던 결함이 여기서 났다.
 *
 * 표에 없는 라벨은 원문으로 떨어진다. 새 지표를 추가하고 등록을 잊으면 화면이
 * 비지 않고 한국어로 보인다 — 눈에 띄어서 고쳐진다.
 */
export const ECONOMY_INDICATOR_LABEL_KEY: Record<string, string> = {
    연방기금금리: 'economyIndicator.Federalfundsrate',
    인플레이션율: 'economyIndicator.Inflationrate',
    소비자물가지수: 'economyIndicator.Consumerpriceindex',
    GDP: 'economyIndicator.GDP',
    산업생산지수: 'economyIndicator.Industrialproductionindex',
    '경기침체 확률': 'economyIndicator.Recessionprobability',
    실업률: 'economyIndicator.Unemploymentrate',
    '비농업 고용': 'economyIndicator.Nonfarmpayrolls',
    '신규 실업수당청구': 'economyIndicator.Initialjoblessclaims',
    '10년물 국채': 'economyIndicator.10yearTreasury',
    '2년물 국채': 'economyIndicator.2yearTreasury',
    '30년 모기지 금리': 'economyIndicator.30yearmortgagerate',
    소매판매: 'economyIndicator.Retailsales',
    '한국 기준금리': 'economyIndicator.BOKbaserate',
    '국고채 3년 낙찰금리': 'economyIndicator.3yearKTBauctionyield',
    '국고채 10년 낙찰금리': 'economyIndicator.10yearKTBauctionyield',
    '소비자물가 상승률': 'economyIndicator.Consumerinflationrate',
    '생산자물가 상승률': 'economyIndicator.Producerinflationrate',
    'GDP 성장률(전년비)': 'economyIndicator.GDPgrowthYoY',
    '산업생산(전년비)': 'economyIndicator.IndustrialproductionYoY',
    '실업률(계절조정)': 'economyIndicator.UnemploymentrateSA',
    '취업자 수(전년비)': 'economyIndicator.EmploymentYoY',
    경상수지: 'economyIndicator.Currentaccount',
    '수출(전년비)': 'economyIndicator.ExportsYoY',
};

/** 카테고리 섹션 제목(금리·물가·성장·고용). */
export const ECONOMY_CATEGORY_LABEL_KEY: Record<string, string> = {
    rates: 'economyCategory.rates',
    inflation: 'economyCategory.inflation',
    growth: 'economyCategory.growth',
    labor: 'economyCategory.labor',
};
