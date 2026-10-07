# `widgets/` — Self-Contained UI Compositions

> Widget은 자기 완결적 UI 단위다. 데이터 fetch, 렌더링, 내부 상호작용을 소유.

## 의존 방향

widgets는 `features/`, `entities/`, `shared/`를 import 가능. **상위 레이어(pages/views, app)를 import할 수 없다.**

## widgets 간 import 금지

다른 위젯의 파일을 import하지 않는다. 둘 이상의 위젯이 필요로 하는 훅·컴포넌트는 `shared/`(도메인 무관 UI·훅) 또는
`entities/`(도메인 훅·로직)로 내리고, 위젯 조합은 `views/`·`app/`에서 한다.

oxlint `no-restricted-imports`는 "자기 슬라이스가 아닌 `@/widgets/*`"를 표현하지 못해
`src/__tests__/guards/noCrossWidgetImports.test.ts`가 대신 강제한다(테스트 파일은 제외).

## 데이터 접근과 `utils/`

- `.tsx` UI 파일은 entity의 `lib/`·`api/`를 직접 부르지 않는다. 데이터·액션은 `hooks/`의 hook이 연결하고(React
  Query 규칙은 `REACT.md`의 "React Query and Server State Rules"), 훅이 entity 타입을 쓸 때도 구현 모듈이 아니라
  타입 정의 파일(`model.ts`/`types.ts`)에서 import한다.
- 위젯 전용 순수 헬퍼는 그 위젯의 `utils/`에 두고, 세 번째 소비자가 생기면 `shared/lib`로 올린다(`src/shared/CLAUDE.md` 규칙 4).
  훅은 `hooks/`, 헬퍼는 `utils/`에 두며 UI 파일과 같은 디렉터리 레벨에 섞지 않는다.

## import 규칙

barrel(`index.ts`)은 금지다. 위젯 컴포넌트·훅·유틸은 정의 파일에서 직접 import한다(테스트·`vi.mock` 포함).
