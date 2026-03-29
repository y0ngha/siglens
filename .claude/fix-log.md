## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: useEffect 내 주석이 실제 동작과 반대로, "새 타임프레임의 bars가 아직 로드 중일 수 있다"고 기술하여 미래 개발자에게 잘못된 맥락을 전달
- Rule: FF.md — Predictability: 숨겨진 로직을 정확하게 드러내야 한다 (2-C. Expose hidden logic)
- Context: ChartContent는 Suspense 경계 내에서 useSuspenseQuery에 의해 bars 로드가 완료된 후에만 remount되므로, 이 useEffect가 실행될 시점에 latestRef.current.bars는 항상 새 타임프레임의 데이터다. "아직 로드 중일 수 있다"는 설명은 실제 동작과 반대이므로 올바른 설명으로 교체함.