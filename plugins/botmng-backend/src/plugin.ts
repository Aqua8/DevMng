import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { BotmngClient } from './botmngClient';
import { createRouter } from './router';

/**
 * BotMng 상태 백엔드 플러그인.
 * BotMng 서비스 계정으로 /api/health 를 읽기 전용으로 조회해 카탈로그 상태 카드에 전달한다.
 *
 * @public
 */
export const botmngPlugin = createBackendPlugin({
  pluginId: 'botmng',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ config, httpAuth, httpRouter, logger }) {
        const baseUrl = config.getOptionalString('botmng.baseUrl');
        const password = config.getOptionalString('botmng.servicePassword');
        if (!baseUrl || !password) {
          logger.warn(
            'botmng.baseUrl 또는 botmng.servicePassword 가 없어 BotMng 상태는 not-configured 로 표시됩니다',
          );
        }
        httpRouter.use(
          await createRouter({
            httpAuth,
            client:
              baseUrl && password
                ? new BotmngClient({ baseUrl, password })
                : undefined,
          }),
        );
      },
    });
  },
});
