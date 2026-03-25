# Common Mistakes

Claude Code가 자주 발생시키는 실수 목록.
구현 전 반드시 확인하고 지켜서 개발하도록 한다.

---

## 코딩 패러다임

```
1. for/while 루프 사용
   → map, filter, reduce, flatMap으로 대체

2. let 재할당
   → const + 새 변수

3. 원본 배열/객체 직접 변경
   → spread 연산자
   ❌ bars.push(newBar)     ✅ [...bars, newBar]

4. 조건 중첩/삼항 중첩
   → 객체 맵 또는 얼리 리턴

5. domain에서 클래스 사용
   → 순수 함수로 대체 (infrastructure Provider는 예외)

6. reduce 콜백 안에서 외부 배열 push
   → accumulator에 spread로 처리
   ❌ result.push(ema)      ✅ return [...acc, ema]

7. 동일 알고리즘 중복 구현
   → 새 함수 구현 전 기존 헬퍼 먼저 확인
   → number[] 기반 헬퍼와 Bar[] 기반 래퍼를 분리해 재사용
```

---

## TypeScript

```
1. any 타입 사용
   → 컴파일 에러 수준으로 금지

2. 도메인 함수 반환 타입 생략
   → 반드시 명시

3. 인디케이터 초기 구간을 0 또는 NaN으로 채우기
   → null로 채울 것

4. 함수 내부에서 type 선언
   → 파일 최상단으로 이동
   ❌ calculateRSI 내부의 type WilderState
   ✅ 파일 최상단에 선언

5. interface 필드에 union 리터럴 2개 이상을 인라인으로 작성
   → 별도 type alias로 분리
   ❌ interface Signal { strength: 'strong' | 'moderate' | 'weak'; }
   ✅ type SignalStrength = 'strong' | 'moderate' | 'weak';
      interface Signal { strength: SignalStrength; }

6. 구현 코드에서 리터럴 하드코딩
   → 상수로 추출 (domain/indicators/constants.ts)
   ❌ period = 14
   ✅ period = RSI_DEFAULT_PERIOD

   [패턴 A] 새 값 선언
   ❌ period = 14                    ✅ const period = RSI_DEFAULT_PERIOD

   [패턴 B] 배열·Record 상수의 특정 값 참조
   ❌ result.ma[20]                  ✅ result.ma[MA_DEFAULT_PERIODS[0]]
   ❌ calculateMA(bars, 20)          ✅ calculateMA(bars, MA_DEFAULT_PERIODS[0])

   [패턴 C] 테스트 입력값 (맥락 파악에 필요한 값만 상수화)
   ❌ makeBars(100)                  ✅ const TEST_BAR_COUNT = 100; makeBars(TEST_BAR_COUNT)
   ✅ provider.analyze('test prompt') // 의미 없는 scaffolding → 리터럴 허용

7. 구현 코드에서 상수 파생 값을 리터럴로 재작성
   → 상수 변경 시 함께 갱신되지 않음
   → 테스트의 expect 검증값은 리터럴 허용
   ❌ (구현) if (label === '150.00') { ... }
   ✅ (테스트) expect(result).toContain('150.00')

8. 구조적 위치를 나타내는 배열 인덱스 하드코딩
   ❌ result.split('\n\n')[1]
   ✅ const MARKET_SECTION_INDEX = 1; result.split('\n\n')[MARKET_SECTION_INDEX]

9. 브라우저/Node 전역 객체명을 변수명으로 사용
   → ESLint no-shadow 에러
   ❌ const window = closes.slice(...)
   ✅ const priceWindow = closes.slice(...)
   충돌 주의 대상: window, document, location, event, name, length, screen

10. Object.fromEntries 반환 타입 불일치
    → Record<K, V>가 필요하면 타입 단언 필수
    ❌ Object.fromEntries(pairs)
    ✅ Object.fromEntries(pairs) as Record<number, (number | null)[]>
```

---

## 컴포넌트

```
1. 'use client' 누락
   → useState/useEffect 사용 시 Next.js 16 빌드 에러

2. Props inline type
   → 별도 interface로 정의

3. 타임프레임을 URL 쿼리 파라미터로 관리
   → 클라이언트 상태로만 관리
```

---

## 도메인 함수

```
1. 외부 라이브러리 import
   → technicalindicators, lodash 등 일체 금지

2. Route Handler에서 인디케이터 계산 직접 작성
   → domain/indicators에서 import해서 사용
```

---

## 테스트

```
1. 새 파일 생성 시 테스트 파일 누락
   → domain/, infrastructure/ 파일과 테스트 파일은 항상 같은 커밋에 포함
   → 기존 파일에서 새 함수를 export할 때도 직접 테스트 케이스 추가
   → 리팩토링으로 추출된 함수라도 간접 검증만으로는 부족

2. 반환 타입 변경 시 테스트 미갱신
   → 타입이 바뀌면 테스트도 반드시 함께 수정
   → nullable 변경(T[] → (T | null)[])은 초기 구간 null 케이스 테스트 필수

3. describe/it 설명을 코드 표현식으로 작성
   ❌ describe('closes.length < period', ...)
   ✅ describe('입력 배열 길이가 period 미만일 때', ...)
   ❌ it('null 반환')
   ✅ it('전부 null인 배열을 반환한다')

4. period 기반 인디케이터에서 초기 구간 null 테스트 케이스 누락
   → 스텁 단계에서 추가해두면 실제 구현 후 회귀 방어 가능
```

---

## Lightweight Charts

```
1. chart.remove() cleanup 누락
   → 컴포넌트 재마운트 시 canvas 중복 생성

2. setData를 실시간 업데이트에 사용
   → series.update() 사용

3. domain의 null을 그대로 setData에 전달
   → WhitespaceData({ time })으로 변환

4. 거래량/RSI를 메인 pane에 추가
   → 반드시 별도 pane(index 1, 2...)에 추가
```

---

## ESLint

```
1. import/first 위반
   → barrel 파일(index.ts)에서 export * 먼저 쓰고 import를 아래에 작성
   → import를 파일 최상단으로 이동

2. EOF 개행 누락
   → yarn format 실행으로 자동 교정
```

---

## 레이어 의존성

```
1. domain에서 외부 라이브러리 import
   → technicalindicators, lodash 등 일체 금지

2. components에서 infrastructure import
   → AlpacaProvider, claudeClient 등 금지

3. Lightweight Charts를 components/chart/ 밖에서 import

4. components/에서 @/lib/* import는 허용
   → lib/는 외부 UI 유틸리티 래퍼 레이어 (cn 등)
   → infrastructure와 달리 components에서 import 가능
```
