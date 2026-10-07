import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { BotmngClient } from './botmngClient';
import { resolveHealth } from './health';

export function createRouter({
  httpAuth,
  client,
  now = () => new Date(),
}: {
  httpAuth: HttpAuthService;
  /** 설정이 없으면 undefined (카드에는 not-configured 로 표시) */
  client?: BotmngClient;
  now?: () => Date;
}): express.Router {
  const router = Router();

  // 로그인한 사용자(게스트 포함)만 조회할 수 있다. 서비스 계정 비밀번호와 BotMng 주소는 응답에 넣지 않는다.
  router.get('/health', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const view = await resolveHealth(client, now());
    res.json(view);
  });

  return router;
}
