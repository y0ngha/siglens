# Git Conventions

## 브랜치 네이밍

```
{type}/#{이슈 번호}/{이슈 한줄 요약}
```

```
feat/#2/도메인-공통-타입-정의
feat/#4/alpaca-provider-구현
fix/#8/rsi-초기구간-null-처리
chore/#1/프로젝트-초기-환경-설정
```

**규칙**
- base 브랜치: master
- 한글 허용, 공백은 하이픈(-)으로 대체
- 영문은 소문자 kebab-case
- 이슈 번호 필수

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
fix: RSI 초기 구간 null 처리 오류 수정
test: calculateRSI 엣지 케이스 테스트 추가
docs: DOMAIN.md VWAP 명세 추가
```

**규칙**
- 한글 사용 가능
- 마침표 없음
- 50자 이내
- 명령형 현재 시제

---

## PR 규칙

```
base 브랜치: master
제목: {type}: {이슈 제목}
```

**본문 템플릿**: `.github/PULL_REQUEST_TEMPLATE.md` 자동 적용됨.