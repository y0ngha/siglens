## 관련 이슈

closes #{이슈}

## 구현 내용

{내용}

## 레이어 및 코드 품질 체크

- [ ] @docs/conventions/CONVENTIONS.md 준수 확인
- [ ] @docs/conventions/FF.md 준수 확인
- [ ] @docs/conventions/REACT.md 준수 확인 (클라이언트 코드를 건드린 경우)
- [ ] @docs/conventions/SERVER.md 준수 확인 (서버 코드를 건드린 경우)
- [ ] @docs/conventions/TESTING.md 준수 확인 (테스트를 건드린 경우)
- [ ] 변경한 레이어의 src/<layer>/CLAUDE.md 준수 확인
- [ ] domain/: 외부 라이브러리 import 없음, 순수 함수만
- [ ] 인디케이터 초기 구간 null 반환 (0, NaN 없음)
- [ ] 반환 타입 명시
- [ ] for/while 없이 map/filter/reduce 사용
- [ ] any 타입 없음
- [ ] 새 파일에 대응하는 테스트 파일 포함
- [ ] 테스트 구조: describe → describe(context) → it
- [ ] 초기 구간 null 케이스 테스트 포함
- [ ] 매직 넘버 없음

## 변경 파일 목록

[생성]

[수정] 

## CI Check lists

- [ ] yarn format
- [ ] yarn lint
- [ ] yarn lint:style
- [ ] yarn test
- [ ] yarn build