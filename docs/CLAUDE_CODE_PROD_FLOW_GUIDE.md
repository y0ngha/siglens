# Claude Code 작업 플로우 가이드

Claude Code가 이슈를 받아 PR까지 처리하는 표준 플로우.

---

## 전체 흐름

```
이슈 파악 → 참고 문서 확인 → 브랜치 생성 → 구현 → 테스트 → 완료 조건 확인 → PR 생성
```

---

## 1. 이슈 파악

```
이슈 #N 확인하고 구현해줘.
```

이슈에서 확인할 것:
- **구현 범위**: 어떤 레이어(domain, infrastructure, app, components)를 건드리는지
- **파일**: 생성/수정할 파일 경로
- **구현 내용**: 함수 시그니처, 기능 명세
- **참고 문서**: 체크된 항목만 읽는다
- **완료 조건**: 구현, 테스트, docs 업데이트 여부

---

## 2. 참고 문서 확인

이슈 본문의 **참고 문서** 항목 중 체크된(`[x]`) 항목만 읽는다.

주로 확인하는 문서:
- `docs/DOMAIN.md` — 인디케이터 계산 명세, 타입 정의, IndicatorResult 규칙
- `docs/CONVENTIONS.md` — 코딩 패러다임, 테스트 규칙, import 경로 규칙
- `docs/ARCHITECTURE.md` — 레이어 구조
- `docs/API.md` — Route Handler 명세

기존 유사 구현도 함께 읽는다 (패턴 파악용).

```
# 예: MA 구현 시 EMA 구현을 참고
src/domain/indicators/ema.ts
src/__tests__/domain/indicators/ema.test.ts
```

---

## 3. 브랜치 생성

`docs/GIT_CONVENTIONS.md` 기준.

```bash
git checkout master
git pull origin master
git checkout -b {type}/#{이슈 번호}/{이슈 한줄 요약}
```

**예시**
```bash
git checkout -b feat/#10/ma-인디케이터-구현
```

---

## 4. 구현

### domain 레이어 기준 체크리스트

- [ ] 외부 라이브러리 import 없음 (technicalindicators 등 일체 금지)
- [ ] 순수 함수 (사이드 이펙트 없음, fetch/console.log/Date.now() 금지)
- [ ] 반환 타입 명시
- [ ] 초기 구간은 `null` (0이나 NaN 금지)
- [ ] 함수형 스타일 (for/while 루프 → map/filter/reduce)
- [ ] 불변성 유지 (원본 배열/객체 변경 금지)
- [ ] path alias 사용 (`@/domain/...`, 상대 경로 금지)

### index.ts export 추가

새 파일 생성 시 `src/domain/indicators/index.ts`에 export 추가.

```typescript
export * from './ma';
```

---

## 5. 테스트 작성

### 파일 위치

```
src/__tests__/domain/indicators/{indicator}.test.ts
```

### 테스트 구조 (`describe → describe → it`)

```typescript
describe('calculateMA', () => {
  describe('입력 배열이 비어있을 때', () => {
    it('빈 배열을 반환한다', () => { ... });
  });

  describe('입력 배열 길이가 period 미만일 때', () => {
    it('전부 null인 배열을 반환한다', () => { ... });
  });

  describe('입력 배열 길이가 period 이상일 때', () => {
    it('처음 period - 1개의 값은 null이다', () => { ... });
    it('핵심 계산 로직이 올바르다', () => { ... });
    // ...
  });
});
```

### period 기반 인디케이터 필수 테스트 케이스

| 케이스 | 설명 |
|--------|------|
| 빈 배열 | 빈 배열을 반환한다 |
| period 미만 입력 | 전부 null인 배열을 반환한다 |
| period와 동일한 입력 | 마지막 값만 null이 아닌 배열을 반환한다 |
| 초기 null 구간 | 처음 period - 1개의 값은 null이다 |
| 정상값 구간 | period번째 이후 값은 null이 아닌 숫자다 |
| 계산 정확성 | 첫 번째 값이 명세와 일치한다 |
| 가격 일정 시 | MA/EMA가 해당 가격과 같다 |

### describe/it 작성 규칙

```
❌ describe('closes.length < period', ...)
✅ describe('입력 배열 길이가 period 미만일 때', ...)

❌ it('null 반환')
✅ it('전부 null인 배열을 반환한다')
```

---

## 6. 완료 조건 확인

다섯 명령어 모두 통과해야 PR 오픈 가능.

```bash
yarn format
yarn lint
yarn lint:style
yarn test
yarn build
```

---

## 7. 커밋

```bash
git add {변경된 파일들}
git commit -m "feat: MA 인디케이터 구현

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

커밋 메시지 규칙은 `docs/GIT_CONVENTIONS.md` 참고.

---

## 8. PR 생성

```bash
git push -u origin {브랜치명}
gh pr create --title "{type}: {이슈 제목}" --body "..." --base master
```

### PR 본문 형식

```markdown
## 관련 이슈

closes #{이슈 번호}

## 구현 내용

- 구현한 파일과 내용 요약

## yarn lint

\`\`\`
실행 결과
\`\`\`

## yarn test

\`\`\`
실행 결과
\`\`\`

## yarn build

\`\`\`
실행 결과
\`\`\`
```

---

## 빠른 참조

| 단계 | 확인 문서 |
|------|-----------|
| 코딩 컨벤션 | `docs/CONVENTIONS.md` |
| 도메인 명세 | `docs/DOMAIN.md` |
| 브랜치/커밋/PR 규칙 | `docs/GIT_CONVENTIONS.md` |
| 아키텍처 구조 | `docs/ARCHITECTURE.md` |