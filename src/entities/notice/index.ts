// 공지 슬라이스 public API.
// - DrizzleNoticeRepository(api.ts)는 server-only이므로 barrel에서 제외한다.
//   server consumer(server action)는 '../api'에서 직접 deep import 한다.
// - server action은 actions.ts barrel(@/entities/notice/actions)에서 import 한다.
export type { NoticeRecord } from './model/types';
export { matchPath } from './lib/matchPath';
export {
    DISMISSED_NOTICES_STORAGE_KEY,
    loadDismissedNoticeIds,
    dismissNotice,
} from './lib/noticeStorage';
