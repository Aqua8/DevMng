import type { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { z } from 'zod/v3';
import { registerHealthAction } from './action';
import { failingClient, NOW } from './testUtils';

const now = () => NOW;

function setup(client?: { getHealth: () => Promise<unknown> }) {
  const register = jest.fn();
  registerHealthAction(
    { register } as unknown as ActionsRegistryService,
    client as never,
    now,
  );
  return register.mock.calls[0][0];
}

describe('get-botmng-health 액션', () => {
  it('읽기 전용·비파괴로 등록된다 (MCP에서 읽기 전용 필터를 통과해야 함)', () => {
    const action = setup();
    expect(action.name).toBe('get-botmng-health');
    expect(action.attributes).toEqual({
      readOnly: true,
      destructive: false,
      idempotent: true,
    });
  });

  it('입력이 없고 출력 형식이 상태 값과 맞다', async () => {
    const action = setup({
      getHealth: async () => ({ status: 'ok', issues: [] }),
    });
    expect(action.schema.input(z).safeParse({}).success).toBe(true);
    const { output } = await action.action({});
    expect(action.schema.output(z).safeParse(output).success).toBe(true);
    expect(output.status).toBe('ok');
  });

  it('BotMng에 연결할 수 없어도 오류 대신 상태로 알린다', async () => {
    const action = setup(
      failingClient(new Error('connect ECONNREFUSED 10.0.0.5')),
    );
    const { output } = await action.action({});
    expect(output.status).toBe('unreachable');
    expect(JSON.stringify(output)).not.toContain('10.0.0.5');
  });
});
