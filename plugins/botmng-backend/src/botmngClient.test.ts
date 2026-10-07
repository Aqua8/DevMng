import {
  BotmngClient,
  BotmngError,
  FetchLike,
  tokenExpiry,
} from './botmngClient';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (expSec: number) =>
  `${b64({ alg: 'HS256' })}.${b64({ exp: expSec })}.sig`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('tokenExpiry', () => {
  it('JWT exp 를 ms 로 읽는다', () => {
    expect(tokenExpiry(jwt(1_000))).toBe(1_000_000);
  });
  it('읽을 수 없으면 undefined', () => {
    expect(tokenExpiry('not-a-jwt')).toBeUndefined();
    expect(tokenExpiry(`a.${b64({})}.c`)).toBeUndefined();
  });
});

describe('BotmngClient', () => {
  const t0 = 1_000_000_000_000; // 임의의 현재 시각(ms)
  const ttl15m = () => jwt((t0 + 15 * 60_000) / 1000);
  const isLogin = (url: string) => url.endsWith('/api/auth/service');
  let now: number;
  let calls: { url: string; init?: RequestInit }[];

  const make = (
    handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  ) => {
    calls = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return handler(url, init);
    };
    return new BotmngClient({
      baseUrl: 'https://botmng.test/',
      password: 'pw-for-test',
      fetch,
      now: () => now,
    });
  };
  /** 로그인은 항상 성공하고, 나머지 요청(/api/health)은 handler 가 답한다 */
  const makeWithLogin = (health: (init?: RequestInit) => Response) =>
    make((url, init) =>
      isLogin(url) ? json({ accessToken: ttl15m() }) : health(init),
    );
  const loginCount = () => calls.filter(c => isLogin(c.url)).length;

  beforeEach(() => {
    now = t0;
  });

  it('토큰을 한 번 받아 캐시하고 /api/health 만 호출한다', async () => {
    const client = makeWithLogin(() => json({ status: 'ok', issues: [] }));
    await client.getHealth();
    await client.getHealth();
    expect(calls.map(c => new URL(c.url).pathname)).toEqual([
      '/api/auth/service',
      '/api/health',
      '/api/health',
    ]);
  });

  it('비밀번호는 토큰 발급 요청 본문에만 실리고 URL 에는 없다', async () => {
    const client = makeWithLogin(() => json({ status: 'ok' }));
    await client.getHealth();
    expect(calls.some(c => c.url.includes('pw-for-test'))).toBe(false);
    expect(calls[0].init?.body).toBe(
      JSON.stringify({ password: 'pw-for-test' }),
    );
    expect(
      (calls[1].init?.headers as Record<string, string>).Authorization,
    ).toMatch(/^Bearer /);
  });

  it('만료 1분 전부터는 새 토큰을 받는다', async () => {
    const client = makeWithLogin(() => json({ status: 'ok' }));
    await client.getHealth();
    now = t0 + 14 * 60_000 + 30_000; // 만료까지 30초 남음
    await client.getHealth();
    expect(loginCount()).toBe(2);
  });

  it('동시에 여러 번 조회해도 로그인은 한 번만 한다', async () => {
    const client = makeWithLogin(() => json({ status: 'ok' }));
    await Promise.all([
      client.getHealth(),
      client.getHealth(),
      client.getHealth(),
    ]);
    expect(loginCount()).toBe(1);
  });

  it('health 가 401 이면 토큰을 새로 받아 한 번만 다시 시도한다', async () => {
    let healthCalls = 0;
    const client = makeWithLogin(() =>
      ++healthCalls === 1
        ? json({}, 401)
        : json({ status: 'warn', issues: ['x'] }),
    );
    await expect(client.getHealth()).resolves.toEqual({
      status: 'warn',
      issues: ['x'],
    });
    expect(loginCount()).toBe(2);
  });

  it('다시 시도해도 401 이면 unauthorized', async () => {
    const client = makeWithLogin(() => json({}, 401));
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('비밀번호가 틀리면 unauthorized', async () => {
    const client = make(() => json({}, 401));
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('연결할 수 없으면 unreachable (원인 메시지를 노출하지 않는다)', async () => {
    const client = make(() => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:443');
    });
    const err = (await client.getHealth().catch(e => e)) as BotmngError;
    expect(err).toBeInstanceOf(BotmngError);
    expect(err.kind).toBe('unreachable');
    expect(err.message).not.toContain('10.0.0.5');
  });

  it('health 가 500 이면 bad-response', async () => {
    const client = makeWithLogin(() => json({}, 500));
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });

  it('인증 실패 뒤 1분 동안은 틀린 비밀번호로 다시 로그인하지 않는다', async () => {
    const client = make(() => json({}, 401));
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(loginCount()).toBe(1);
    now = t0 + 61_000;
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(loginCount()).toBe(2);
  });

  it('로그인이 403(계정 비활성 등)이어도 unauthorized 로 알린다', async () => {
    const client = make(() => json({}, 403));
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('리다이렉트를 따라가지 않는다 (비밀번호가 담긴 요청이 다른 곳으로 재전송되지 않게)', async () => {
    const client = makeWithLogin(() => json({ status: 'ok' }));
    await client.getHealth();
    expect(calls.every(c => c.init?.redirect === 'error')).toBe(true);
  });

  it('같은 토큰으로 동시에 401을 받아도 새로 받은 토큰을 지워 또 로그인하지 않는다', async () => {
    let issued = 0;
    // 첫 토큰(t1)은 거부되고 그 뒤에 받은 토큰은 수락된다
    const client = make((url, init) => {
      if (isLogin(url))
        return json({ accessToken: `${ttl15m()}.t${++issued}` });
      const bearer = (init?.headers as Record<string, string>).Authorization;
      return bearer.endsWith('.t1') ? json({}, 401) : json({ status: 'ok' });
    });
    const both = await Promise.all([client.getHealth(), client.getHealth()]);
    expect(both).toEqual([{ status: 'ok' }, { status: 'ok' }]);
    expect(loginCount()).toBe(2); // t1 한 번, 거부된 뒤 새 토큰 한 번 (세 번이 아니다)
  });
});
