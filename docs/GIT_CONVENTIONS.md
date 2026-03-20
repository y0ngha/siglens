# Git Convention

## 브랜치 네이밍

```
{type}/#{이슈 번호}/{이슈 한줄 요약}
```

**예시**
```
feat/#2/도메인-공통-타입-정의
feat/#4/alpaca-provider-구현
fix/#8/rsi-초기구간-null-처리
chore/#1/프로젝트-초기-환경-설정
style/#22/ma-ema-오버레이-컴포넌트
```

**규칙**
```
- base 브랜치: master
- 한글 허용, 공백은 하이픈(-)으로 대체
- 영문은 소문자 kebab-case
- 이슈 번호 필수
```

---

## 커밋 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 | `feat: RSI 인디케이터 구현` |
| `fix` | 버그 수정 | `fix: RSI 초기 구간 null 처리 오류` |
| `chore` | 빌드, 설정, 패키지 | `chore: jest 설정 업데이트` |
| `style` | 코드 포맷, 스타일 | `style: MA 오버레이 컬러 수정` |
| `refactor` | 리팩토링 | `refactor: AlpacaProvider 에러 처리 개선` |
| `test` | 테스트 추가/수정 | `test: calculateMACD 엣지 케이스 추가` |
| `docs` | 문서 수정 | `docs: DOMAIN.md RSI 명세 업데이트` |

---

## 커밋 메시지 형식

```
{type}: {변경 내용}
```

**예시**
```
feat: 도메인 공통 타입 정의
feat: AlpacaProvider getBars() 구현
fix: RSI 초기 구간 null 처리 오류 수정
test: calculateRSI 엣지 케이스 테스트 추가
chore: tsconfig paths 설정
docs: DOMAIN.md VWAP 명세 추가
```

**규칙**
```
- 한글 사용 가능
- 마침표 없음
- 50자 이내
- 명령형 현재 시제
```

---

## PR 규칙

```
base 브랜치: master
head 브랜치: {type}/#{이슈 번호}/{이슈 한줄 요약}

제목: {type}: {이슈 제목}
예시: feat: 도메인 공통 타입 정의

본문에 포함할 것:
- 관련 이슈: closes #{이슈 번호}
- yarn format 실행 결과
- yarn lint 실행 결과
- yarn lint:style 실행 결과
- yarn test 실행 결과
- yarn build 실행 결과
```

---

## Claude Code 작업 절차

코드 구현 이슈를 처리할 때 반드시 아래 순서를 따른다.

```
1. master 브랜치 기준으로 브랜치 생성
   git checkout master
   git pull origin master
   git checkout -b {type}/#{이슈 번호}/{이슈 한줄 요약}

2. 구현 + 테스트 작성

3. 완료 조건 확인 (모두 통과해야 PR 오픈 가능)
   yarn format
   yarn lint
   yarn lint:style
   yarn test
   yarn build

4. master <- 새 브랜치 방향으로 PR 오픈
   제목: {type}: {이슈 제목}
   본문: closes #{이슈 번호} + 각 명령어 실행 결과
```