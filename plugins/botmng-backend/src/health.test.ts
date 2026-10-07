import { BotmngError } from './botmngClient';
import { resolveHealth, toHealthView } from './health';
import { failingClient, NOW } from './testUtils';

describe('toHealthView', () => {
  it('status 와 issues 만 꺼낸다 (다른 값은 버린다)', () => {
    expect(
      toHealthView(
        {
          status: 'warn',
          issues: ['수집이 밀리고 있습니다'],
          db: { size: 1 },
          extra: 'x',
        },
        NOW,
      ),
    ).toEqual({
      status: 'warn',
      issues: ['수집이 밀리고 있습니다'],
      checkedAt: NOW.toISOString(),
    });
  });
  it('문자열이 아닌 issues 항목은 거른다', () => {
    expect(
      toHealthView({ status: 'ok', issues: ['a', 1, null] }, NOW).issues,
    ).toEqual(['a']);
  });
  it('issues 는 20개, 항목당 200자까지만 남긴다 (LLM 에 그대로 전달되므로)', () => {
    const many = Array.from({ length: 30 }, (_, i) => 'x'.repeat(300) + i);
    const { issues } = toHealthView({ status: 'warn', issues: many }, NOW);
    expect(issues).toHaveLength(20);
    expect(issues.every(i => i.length <= 200)).toBe(true);
  });
  it('형식이 다르면 error', () => {
    expect(toHealthView({ status: 'great' }, NOW).status).toBe('error');
    expect(toHealthView(null, NOW).status).toBe('error');
  });
});

describe('resolveHealth', () => {
  it('상태를 카드·MCP용 값으로 만든다', async () => {
    const view = await resolveHealth(
      { getHealth: async () => ({ status: 'warn', issues: ['x'] }) },
      NOW,
    );
    expect(view).toEqual({
      status: 'warn',
      issues: ['x'],
      checkedAt: NOW.toISOString(),
    });
  });
  it('설정이 없으면 not-configured', async () => {
    expect((await resolveHealth(undefined, NOW)).status).toBe('not-configured');
  });
  it('연결 불가·인증 실패를 상태로 알린다', async () => {
    expect(
      (
        await resolveHealth(
          failingClient(new BotmngError('unreachable', 'a')),
          NOW,
        )
      ).status,
    ).toBe('unreachable');
    expect(
      (
        await resolveHealth(
          failingClient(new BotmngError('unauthorized', 'a')),
          NOW,
        )
      ).status,
    ).toBe('unauthorized');
  });
  it('예상하지 못한 오류는 원인을 숨기고 unreachable 로 알린다', async () => {
    const view = await resolveHealth(
      failingClient(new Error('boom https://internal.example')),
      NOW,
    );
    expect(view.status).toBe('unreachable');
    expect(JSON.stringify(view)).not.toContain('internal.example');
  });
});
