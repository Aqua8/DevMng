import { createBackend } from '@backstage/backend-defaults';
import { mockServices } from '@backstage/backend-test-utils';

// 플러그인만 따로 띄워 보는 개발용 백엔드. 인증은 모의 서비스로 대체한다.
//
//   BOTMNG_URL=... BOTMNG_SERVICE_PASSWORD=... yarn start   (이 폴더에서)
//   curl http://localhost:7007/api/botmng/health
//
// 설정 값은 환경 변수로만 넘기고 저장소에 올리지 않는다.

const backend = createBackend();
backend.add(mockServices.auth.factory());
backend.add(mockServices.httpAuth.factory());
backend.add(
  mockServices.rootConfig.factory({
    data: {
      botmng: {
        baseUrl: process.env.BOTMNG_URL,
        servicePassword: process.env.BOTMNG_SERVICE_PASSWORD,
      },
    },
  }),
);
backend.add(import('../src'));
backend.start();
