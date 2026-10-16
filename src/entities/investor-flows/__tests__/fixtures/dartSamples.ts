/**
 * OpenDART 응답 샘플 — 개발가이드(2026-10-16 확인)의 응답 필드 정의와 형식 그대로 만든 행이다(가이드 페이지는 실제 응답 예시를
 * 싣지 않는다): 2019021 대량보유(`rcept_dt` YYYYMMDD, 수량 쉼표 문자열, 없는 값 `-`), 2019022 임원·주요주주(`rcept_dt`
 * YYYY-MM-DD, `9,999,999,999`·`0.00` 형식), 2019001 공시검색, 2019018 고유번호 XML. 고유번호 `00126380`(삼성전자)은 가이드의
 * 테스트 입력 예시다.
 */

export const SAMSUNG_CORP = '00126380';

export const MAJOR_STOCK_LIST = [
    {
        rcept_no: '20260311000555',
        rcept_dt: '20260311',
        corp_code: SAMSUNG_CORP,
        corp_name: '삼성전자',
        report_tp: '일반',
        repror: '국민연금공단',
        stkqy: '432,154,213',
        stkqy_irds: '-25,165,617',
        stkrt: '7.24',
        stkrt_irds: '-0.36',
        ctr_stkqy: '-',
        ctr_stkrt: '-',
        report_resn: '보유주식등의 수 변동\n- 장내매도',
    },
    {
        rcept_no: '20260105000101',
        rcept_dt: '20260105',
        corp_code: SAMSUNG_CORP,
        corp_name: '삼성전자',
        report_tp: '약식',
        repror: 'BlackRock Fund Advisors',
        stkqy: '300,610,215',
        stkqy_irds: '3,049,320',
        stkrt: '5.03',
        stkrt_irds: '0.05',
        ctr_stkqy: '-',
        ctr_stkrt: '-',
        report_resn: '-',
    },
] as const;

export const EXECUTIVE_STOCK_LIST = [
    {
        rcept_no: '20261002000321',
        rcept_dt: '2026-10-02',
        corp_code: SAMSUNG_CORP,
        corp_name: '삼성전자',
        repror: '홍길동',
        isu_exctv_rgist_at: '등기임원',
        isu_exctv_ofcps: '사내이사',
        isu_main_shrholdr: '-',
        sp_stock_lmp_cnt: '12,000',
        sp_stock_lmp_irds_cnt: '2,000',
        sp_stock_lmp_rate: '0.00',
        sp_stock_lmp_irds_rate: '0.00',
    },
    {
        rcept_no: '20260915000222',
        rcept_dt: '2026-09-15',
        corp_code: SAMSUNG_CORP,
        corp_name: '삼성전자',
        repror: '삼성생명보험',
        isu_exctv_rgist_at: '-',
        isu_exctv_ofcps: '-',
        isu_main_shrholdr: '10%이상주주',
        sp_stock_lmp_cnt: '508,157,148',
        sp_stock_lmp_irds_cnt: '-1,250,000',
        sp_stock_lmp_rate: '8.51',
        sp_stock_lmp_irds_rate: '-0.02',
    },
    {
        rcept_no: '20260801000777',
        rcept_dt: '2026-08-01',
        corp_code: SAMSUNG_CORP,
        corp_name: '삼성전자',
        repror: '김미등',
        isu_exctv_rgist_at: '비등기임원',
        isu_exctv_ofcps: '상무',
        isu_main_shrholdr: '-',
        sp_stock_lmp_cnt: '1,500',
        sp_stock_lmp_irds_cnt: '-',
        sp_stock_lmp_rate: '0.00',
        sp_stock_lmp_irds_rate: '-',
    },
] as const;

/** 공시검색 행(2019001) — `rcept_dt` YYYYMMDD, 비상장은 `stock_code` 공백. */
export const listRow = (over: Record<string, string> = {}) => ({
    corp_cls: 'Y',
    corp_name: '삼성전자',
    corp_code: SAMSUNG_CORP,
    stock_code: '005930',
    report_nm: '임원ㆍ주요주주특정증권등소유상황보고서',
    rcept_no: '20261015000123',
    flr_nm: '홍길동',
    rcept_dt: '20261015',
    rm: '',
    ...over,
});

/** `CORPCODE.xml` 한 덩어리(2019018 형식) — 상장사 3, 비상장 1(공백 종목코드), 영문 섞인 신규 코드 1. */
export const CORP_CODE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
<list>
    <corp_code>00126380</corp_code>
    <corp_name>삼성전자</corp_name>
    <corp_eng_name>SAMSUNG ELECTRONICS CO,.LTD</corp_eng_name>
    <stock_code>005930</stock_code>
    <modify_date>20260607</modify_date>
</list>
<list>
    <corp_code>00434003</corp_code>
    <corp_name>다코</corp_name>
    <corp_eng_name>Daco corporation</corp_eng_name>
    <stock_code> </stock_code>
    <modify_date>20170630</modify_date>
</list>
<list>
    <corp_code>00160843</corp_code>
    <corp_name>한화</corp_name>
    <corp_eng_name>HANWHA CORPORATION</corp_eng_name>
    <stock_code>000880</stock_code>
    <modify_date>20260401</modify_date>
</list>
<list>
    <corp_code>01799999</corp_code>
    <corp_name>덕양에너젠</corp_name>
    <corp_eng_name>DUKYANG ENERGEN</corp_eng_name>
    <stock_code>0001a0</stock_code>
    <modify_date>20260801</modify_date>
</list>
<list>
    <corp_code>BADCODE1</corp_code>
    <corp_name>깨진행</corp_name>
    <corp_eng_name>BROKEN</corp_eng_name>
    <stock_code>123450</stock_code>
    <modify_date>20260101</modify_date>
</list>
</result>
`;
