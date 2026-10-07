import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  registerMswTestHooks,
  renderInTestApp,
} from '@backstage/frontend-test-utils';
import { BotmngHealthCard } from './BotmngHealthCard';

describe('BotmngHealthCard', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const respond = (body: Record<string, unknown>, status = 200) =>
    server.use(
      http.get('*/api/botmng/health', () =>
        HttpResponse.json(body, { status }),
      ),
    );

  it('정상 상태를 보여 준다', async () => {
    respond({
      status: 'ok',
      issues: [],
      checkedAt: '2026-10-07T00:00:00.000Z',
    });
    await renderInTestApp(<BotmngHealthCard />);
    expect(await screen.findByText('정상')).toBeInTheDocument();
    expect(screen.getByText('BotMng 상태')).toBeInTheDocument();
  });

  it('주의 상태와 이유를 보여 준다', async () => {
    respond({
      status: 'warn',
      issues: ['수집이 밀리고 있습니다 (out.log)'],
      checkedAt: '2026-10-07T00:00:00.000Z',
    });
    await renderInTestApp(<BotmngHealthCard />);
    expect(await screen.findByText('주의')).toBeInTheDocument();
    expect(
      screen.getByText('수집이 밀리고 있습니다 (out.log)'),
    ).toBeInTheDocument();
  });

  it('연결 불가를 보여 준다', async () => {
    respond({
      status: 'unreachable',
      issues: ['BotMng에 연결할 수 없습니다'],
      checkedAt: '2026-10-07T00:00:00.000Z',
    });
    await renderInTestApp(<BotmngHealthCard />);
    expect(await screen.findByText('연결 불가')).toBeInTheDocument();
  });

  it('백엔드가 실패하면 오류 문구를 보여 준다', async () => {
    respond({}, 500);
    await renderInTestApp(<BotmngHealthCard />);
    expect(
      await screen.findByText('상태를 가져오지 못했습니다 (500)'),
    ).toBeInTheDocument();
  });

  it('응답 모양이 다르면 오류 문구를 보여 준다', async () => {
    respond({ hello: 'world' });
    await renderInTestApp(<BotmngHealthCard />);
    expect(
      await screen.findByText('상태 응답 형식이 올바르지 않습니다'),
    ).toBeInTheDocument();
  });
});
