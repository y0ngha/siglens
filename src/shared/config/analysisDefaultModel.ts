import type { ModelId } from '@y0ngha/siglens-core';

/**
 * 분석 기본 모델 — 저장된 선택이 없거나 고를 수 없을 때 화면이 쓰는 모델이자, 서버가
 * 꺼진 서버 키 모델을 대체할 때 돌리는 모델(`resolveServableModelId`). 두 쪽이 같은
 * 상수를 써야 서버가 바꿔 돌린 결과와 화면의 선택이 같은 모델을 가리킨다.
 *
 * core 상수(`DEEPSEEK_V4_1_FLASH_MODEL`)를 모듈 최상위에서 읽지 않고 리터럴로 둔다 —
 * 이 모듈은 클라이언트·서버 양쪽에서 널리 import되고, core를 부분 목으로 둔 테스트가
 * import 순간 깨진다. 값이 core 로스터에 있는지는 `ModelId` 타입이, core 상수와 같은지는
 * 테스트가 고정한다.
 */
export const DEFAULT_ANALYSIS_MODEL: ModelId = 'deepseek-v4.1-flash';
