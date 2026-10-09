import { MS_PER_SECOND } from './time';

/** 토스트 자동 닫힘. 한 번에 하나만 띄우므로 새 토스트가 오면 이 타이머는 다시 시작된다. */
export const TOAST_AUTO_DISMISS_MS = 5 * MS_PER_SECOND;
