import { cache } from 'react';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';

// generateMetadata와 page body 양쪽에서 같은 티커를 fetch하므로 React.cache로 동일 render pass 안에서 dedupe.
// 각 RSC 페이지에 동일한 wrapper를 4번 정의하던 패턴을 한 곳으로 모은다.
export const getAssetInfoCached = cache(getAssetInfoAction);
