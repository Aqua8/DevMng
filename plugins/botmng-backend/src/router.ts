import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { BotmngClient, BotmngError } from './botmngClient';
import { failureView, HealthView, toHealthView } from './health';

export async function createRouter({
  httpAuth,
  client,
  now = () => new Date(),
}: {
  httpAuth: HttpAuthService;
  /** 설정이 없으면 undefined (카드에는 not-configured 로 표시) */
  client?: BotmngClient;
  now?: () => Date;
}): Promise<express.Router> {
  const router = Router();

  // 로그인한 사용자(게스트 포함)만 조회할 수 있다. 서비스 계정 비밀번호와 BotMng 주소는 응답에 넣지 않는다.
  router.get('/health', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    let view: HealthView;
    if (!client) {
      view = failureView(
        'not-configured',
        'BotMng 연동 설정(botmng.baseUrl, botmng.servicePassword)이 없습니다',
        now(),
      );
    } else {
      try {
        view = toHealthView(await client.getHealth(), now());
      } catch (err) {
        view =
          err instanceof BotmngError && err.kind !== 'bad-response'
            ? failureView(err.kind, err.message, now())
            : failureView(
                'unreachable',
                'BotMng 상태를 확인할 수 없습니다',
                now(),
              );
      }
    }
    res.json(view);
  });

  return router;
}
