---
name: Refactoring
about: 코드 구조 개선 요청
title: "[Refactor] "
labels: refactoring
assignees: y0ngha

---

## 무엇을 리팩토링하는가

<!-- 대상 파일/모듈과 현재 구조를 간략히 설명 -->

## 왜 리팩토링이 필요한가

<!-- 현재 코드의 문제 유형 (해당 항목 체크) -->

- [ ] 응집도 낮음 (한 모듈에 관련 없는 로직이 섞여 있음)
- [ ] 결합도 높음 (레이어 간 의존 방향이 잘못됨)
- [ ] 도메인 로직이 컴포넌트/훅에 누수됨
- [ ] 중복 코드 (동일 패턴이 여러 곳에 분산됨)
- [ ] 테스트 불가능한 구조
- [ ] Best Practice 미준수
- [ ] 기타:

## 현재 구조 (AS-IS)

<!-- 어떤 구조로 되어 있는지, 어떤 흐름으로 동작하는지 -->

## 목표 구조 (TO-BE)

<!-- 리팩토링 후 어떤 구조가 되어야 하는지 -->

## 영향 범위

<!-- 리팩토링 대상 레이어 -->

- [ ] `domain/`
- [ ] `infrastructure/`
- [ ] `app/`
- [ ] `components/`

## 참고 문서

- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/DOMAIN.md`
- [ ] `docs/API.md`
- [ ] `docs/CONVENTIONS.md`
- [ ] `docs/FF.md`
- [ ] `docs/DESIGN.md`

## 완료 조건

- [ ] 동작 변경 없음 (기존 테스트 전부 통과)
- [ ] 리팩토링 후 테스트 커버리지 유지 또는 향상
- [ ] docs/ 업데이트 (구조 변경 시)