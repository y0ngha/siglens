# Claude Code 작업 플로우

## 전체 흐름

```
이슈 파악 → 참고 문서 확인 → 브랜치 생성 → 구현 → 테스트 → 완료 조건 확인 → 사용자 검토 대기 → 커밋 및 PR 생성
```

---

## 1. 이슈 → PR 절차

### 1-1. 이슈 파악

이슈에서 확인할 것:
- **구현 범위**: 어떤 레이어(domain, infrastructure, app, components)를 건드리는지
- **파일**: 생성/수정할 파일 경로
- **구현 내용**: 함수 시그니처, 기능 명세
- **참고 문서**: 체크된(`[x]`) 항목만 읽는다
- **완료 조건**: 구현, 테스트, docs 업데이트 여부

### 1-2. 참고 문서 확인

이슈 본문의 참고 문서 중 체크된 항목만 읽는다.

```
docs/DOMAIN.md       인디케이터 계산 명세, 타입 정의, IndicatorResult 규칙
docs/CONVENTIONS.md  코딩 패러다임, 테스트 규칙, import 경로 규칙
docs/ARCHITECTURE.md 레이어 구조
docs/API.md          Alpaca API 엔드포인트, 요청/응답 스키마
docs/MISTAKES.md     코드 작업시 자주하는 실수 목록
docs/SIGLENS_API.md  우리 프로젝트(SIGLENS)의 API 엔드포인트, 요청/응답 스키마
```

기존 유사 구현도 함께 읽는다 (패턴 파악용).
```
# 예: MA 구현 시 EMA 구현을 먼저 확인
src/domain/indicators/ema.ts
src/__tests__/domain/indicators/ema.test.ts
```

### 1-3. 브랜치 생성

```bash
git checkout master && git pull origin master
git checkout -b {type}/#{이슈 번호}/{이슈 한줄 요약}
```

브랜치/커밋 규칙 → `docs/GIT_CONVENTIONS.md` 참고

### 1-4. 구현

코딩 규칙 → `docs/CONVENTIONS.md` 참고

자주 하는 실수는 `docs/MISTAKES.md` 참고 → 실수가 나오지 않도록 내용 확인 필요 

**domain 레이어 체크리스트**
- [ ] 외부 라이브러리 import 없음
- [ ] 순수 함수 (fetch/console.log/Date.now() 금지)
- [ ] 반환 타입 명시
- [ ] 초기 구간 `null` (0/NaN 금지)
- [ ] 함수형 스타일 (for/while 금지)
- [ ] 불변성 유지 (원본 배열/객체 변경 금지)
- [ ] path alias 사용 (`@/domain/...`)

새 파일 생성 시 `src/domain/indicators/index.ts`에 export 추가.

### 1-5. 테스트 작성

테스트 규칙 → `docs/CONVENTIONS.md` 참고

새 파일 생성과 테스트 파일은 반드시 같은 커밋에 포함.

### 1-6. PR 템플릿 내 [레이어 및 코드 품질 체크] 확인

[레이어 및 코드 품질 체크]에 있는 내용을 위반한게 있는지 검사.
만약 위반되어 있는게 있다면 수정.

### 1-7. 완료 조건 확인

모두 통과해야 PR 오픈 가능. 하나라도 실패 시 수정 후 재실행.

```bash
yarn format
yarn lint
yarn lint:style
yarn test
yarn build
```

### 1-8. 사용자 검토 대기

**완료 조건 통과 후 바로 커밋/푸시하지 않는다.**

구현 결과를 사용자에게 보고하고 검토를 요청한다.
사용자가 직접 코드를 확인하고 수정한 뒤 진행 요청을 보내면 다음 단계로 넘어간다.

### 1-9. 커밋 및 PR 생성

```bash
git add {변경된 파일들}
git commit -m "{type}: {변경 내용}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push -u origin {브랜치명}
gh pr create --title "{type}: {이슈 제목}" --body "..." --base master
```

PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`가 적용되는데, 템플릿의 헤드에 맞게 결과와 내용을 작성한다.

---

## 2. PR 리뷰 수정 절차

이미 오픈된 PR에 리뷰 코멘트가 달렸고, 그 내용을 수정해야 할 때.

```
발생 상황
- Claude Code Review가 자동으로 달아준 리뷰 코멘트에 대한 수정 요청
- 사람이 직접 PR에 달아준 리뷰 코멘트에 대한 수정 요청
→ 두 경우 모두 동일한 절차를 따른다
```

**핵심 원칙: 새 브랜치/PR 생성 금지. 기존 PR 브랜치에서 직접 수정 후 푸시.**

### 2-1. 컨텍스트 파악

```bash
gh pr view {PR 번호} --repo {repo}
```

PR 전체 내용, 리뷰 코멘트, 현재 브랜치명을 파악한다.

### 2-2. 헤드 브랜치 체크아웃

```bash
gh pr view {PR 번호} --json headRefName --repo {repo}
git fetch origin {헤드 브랜치명} && git checkout {헤드 브랜치명}
```

### 2-3. 수정

리뷰 내용을 반영해 코드를 수정한다.

```
⚠️ 주의: 여러 리뷰 코멘트가 있을 때
→ 하나의 @claude 코멘트에 모든 수정 요청을 모아서 전달한다.
→ 코멘트를 나눠서 달면 같은 브랜치에서 동시에 작업하려다 충돌 발생.
```

### 2-4. 완료 조건 확인

모두 통과해야 푸시 가능. 하나라도 실패 시 수정 후 재실행.

```bash
yarn format
yarn lint
yarn lint:style
yarn test
yarn build
```

### 2-5. 사용자 검토 대기

**완료 조건 통과 후 바로 푸시하지 않는다.**

수정 결과를 사용자에게 보고하고 검토를 요청한다.
사용자가 직접 코드를 확인하고 수정한 뒤 진행 요청을 보내면 다음 단계로 넘어간다.

### 2-6. 푸시

```bash
git push origin {헤드 브랜치명}
```

기존 PR에 완료 코멘트 작성. 새 PR 오픈 금지.

---

## 3. 공통 처리 절차

### 컨텍스트 파악

작업 시작 전 반드시 이슈 또는 PR 전체 내용을 파악한다.

```bash
# 이슈인 경우
gh issue view {번호} --repo {repo}

# PR인 경우
gh pr view {번호} --repo {repo}
```

번호가 이슈인지 PR인지 모를 때:
```bash
gh pr view {번호} --repo {repo}
# 성공 → PR 컨텍스트 (리뷰 수정 절차 따름)
# 실패 → 이슈 컨텍스트 (이슈→PR 절차 따름)
```

### 작업 상태 코멘트

실패 시 반드시 코멘트를 남긴다.

**이슈 컨텍스트**
```bash
gh issue comment {번호} --repo {repo} --body "❌ 작업이 실패했습니다. 사유: {실패 원인}"
```

**PR 컨텍스트**
```bash
gh pr comment {번호} --repo {repo} --body "❌ 작업이 실패했습니다. 사유: {실패 원인}"
```

---

## 빠른 참조

| 항목           | 문서                       |
|--------------|--------------------------|
| 코딩 규칙 | `docs/CONVENTIONS.md`    |
| 도메인 인디케이터 명세 | `docs/DOMAIN.md`         |
| 브랜치/커밋/PR 규칙 | `docs/GIT_CONVENTIONS.md` |
| 레이어 구조       | `docs/ARCHITECTURE.md`   |
| 자주 하는 실수     | `docs/MISTAKES.md`       |