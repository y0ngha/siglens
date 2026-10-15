/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️  FINRA 데이터 이용 약관 — 비상업(non-commercial) 전용. 상업화 전에 반드시 끄거나 라이선스를 받을 것.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 공매도 잔고(`shrt*.csv`)와 일별 공매도 거래량(`CNMSshvol*.txt`)은 FINRA 데이터이며,
 * FINRA의 이용 약관은 이를 **비상업적 목적에서만** 쓰도록 허용한다. siglens가 유료 기능·광고 수익 등
 * 상업적 서비스로 넘어가는 시점에는 이 데이터를 계속 쓰려면 FINRA와 데이터 라이선스를 맺어야 한다.
 * 라이선스 이슈: https://github.com/y0ngha/siglens/issues/1042 (#1042)
 *
 * 그래서 이 데이터의 수집·저장·표시 전부를 **하나의 env 플래그**로 끌 수 있게 했다:
 *
 *     FINRA_SHORT_DATA_ENABLED=false
 *
 *  - 꺼지면 `finra-short` cron은 아무것도 받지 않고(HTTP 요청 0건) 종료한다.
 *  - 꺼지면 `InvestorFlowsDataProvider`는 `shortInterest`·`shortVolume`을 DB를 읽지 않고 `null`로 돌려준다.
 *    (이미 쌓인 행은 지우지 않는다 — 켜면 다시 보인다. 라이선스 문제로 폐기하려면 두 테이블을 비울 것.)
 *  - 값이 비어 있거나 `true`/`1`이면 켜진 것이다. **현재 기본값은 켜짐**(비상업 단계).
 *    `false`/`0`/`off`/`no`(대소문자 무관)만 끈다.
 *
 * 상업화 체크리스트(#1042): (1) 이 플래그를 `false`로 → (2) 화면의 공매도 섹션이 사라지는지 확인 →
 * (3) 라이선스 확보 시에만 다시 켠다. 기본값을 바꿔야 한다면 이 함수 한 곳만 고친다.
 */
export function isFinraShortDataEnabled(): boolean {
    const raw = process.env.FINRA_SHORT_DATA_ENABLED?.trim().toLowerCase();
    if (raw === undefined || raw === '') return true;
    return !['false', '0', 'off', 'no'].includes(raw);
}
