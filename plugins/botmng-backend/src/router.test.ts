import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { BotmngClient, BotmngError } from './botmngClient';
import { createRouter } from './router';
import { failingClient, NOW } from './testUtils';

describe('createRouter', () => {
  const build = async (client?: Pick<BotmngClient, 'getHealth'>) => {
    const router = createRouter({
      httpAuth: mockServices.httpAuth(),
      client: client as BotmngClient,
      now: () => NOW,
    });
    const app = express();
    app.use(router);
    app.use(mockErrorHandler());
    return app;
  };

  it('BotMng 상태를 카드용 값으로 돌려준다', async () => {
    const app = await build({
      getHealth: async () => ({ status: 'ok', issues: [], secret: 'x' }),
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      issues: [],
      checkedAt: NOW.toISOString(),
    });
  });

  it('BotMng에 연결할 수 없어도 200 으로 unreachable 을 알린다', async () => {
    const app = await build(
      failingClient(
        new BotmngError('unreachable', 'BotMng에 연결할 수 없습니다'),
      ),
    );
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unreachable');
  });

  it('예상하지 못한 오류도 포털을 죽이지 않고 unreachable 로 알린다', async () => {
    const app = await build(
      failingClient(new Error('boom: https://internal.example/secret')),
    );
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unreachable');
    expect(JSON.stringify(res.body)).not.toContain('internal.example');
  });

  it('설정이 없으면 not-configured', async () => {
    const app = await build(undefined);
    const res = await request(app).get('/health');
    expect(res.body.status).toBe('not-configured');
  });

  it('로그인하지 않은 요청은 거부한다', async () => {
    const app = await build({ getHealth: async () => ({ status: 'ok' }) });
    const res = await request(app)
      .get('/health')
      .set('Authorization', mockCredentials.none.header());
    expect(res.status).toBe(401);
  });
});
