/**
 * 공시 목록의 종류 라벨 — 8-K 항목 코드를 `widgets.news.CompanyFilings` 카탈로그의 키로 잇는다(네임스페이스 상대 키).
 * 소비 파일이 그 네임스페이스 전용 번역기로 `tItem(FILING_ITEM_KEY[code])`를 직접 호출해야 추출기가 이 네임스페이스만
 * 라우트 번들에 싣는다 — `widgets.news` 번역기로 부르면 `widgets.news` 전체가 실린다.
 * 표에 없는 코드는 화면이 코드를 그대로 보여 준다(`항목 9.99`).
 */
export const FILING_ITEM_KEY: Readonly<Record<string, string>> = {
    '1.01': 'item101',
    '1.02': 'item102',
    '1.03': 'item103',
    '2.01': 'item201',
    '2.02': 'item202',
    '2.03': 'item203',
    '2.05': 'item205',
    '2.06': 'item206',
    '3.01': 'item301',
    '3.02': 'item302',
    '3.03': 'item303',
    '4.01': 'item401',
    '4.02': 'item402',
    '5.01': 'item501',
    '5.02': 'item502',
    '5.03': 'item503',
    '5.07': 'item507',
    '7.01': 'item701',
    '8.01': 'item801',
};
