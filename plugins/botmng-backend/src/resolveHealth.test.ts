import { BotmngError } from './botmngClient';
import { resolveHealth } from './resolveHealth';

const now = new Date('2026-10-07T00:00:00Z');
const failing = (err: unknown) => ({
  getHealth: async () => {
    throw err;
  },
});

describe('resolveHealth', () => {
  it('상태를 카드·MCP용 값으로 만든다', async () => {
    const view = await resolveHealth(
      { getHealth: async () => ({ status: 'warn', issues: ['x'] }) },
      now,
    );
    expect(view).toEqual({
      status: 'warn',
      issues: ['x'],
      checkedAt: now.toISOString(),
    });
  });
  it('설정이 없으면 not-configured', async () => {
    expect((await resolveHealth(undefined, now)).status).toBe('not-configured');
  });
  it('연결 불가·인증 실패를 상태로 알린다', async () => {
    expect(
      (await resolveHealth(failing(new BotmngError('unreachable', 'a')), now))
        .status,
    ).toBe('unreachable');
    expect(
      (await resolveHealth(failing(new BotmngError('unauthorized', 'a')), now))
        .status,
    ).toBe('unauthorized');
  });
  it('예상하지 못한 오류는 원인을 숨기고 unreachable 로 알린다', async () => {
    const view = await resolveHealth(
      failing(new Error('boom https://internal.example')),
      now,
    );
    expect(view.status).toBe('unreachable');
    expect(JSON.stringify(view)).not.toContain('internal.example');
  });
});
