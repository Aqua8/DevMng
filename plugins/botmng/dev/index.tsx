import { createDevApp } from '@backstage/frontend-dev-utils';

import plugin from '../src';

// 카드는 카탈로그의 엔티티 페이지에 붙으므로, 실제 확인은 앱(packages/app)에서 한다.
createDevApp({ features: [plugin] });
