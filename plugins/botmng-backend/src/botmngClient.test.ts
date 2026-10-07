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
  const ttl15m = () => jwt((t0 + 15 * 60_000) / 1000);

  beforeEach(() => {
    now = t0;
  });

  it('토큰을 한 번 받아 캐시하고 /api/health 만 호출한다', async () => {
    const client = make(url =>
      url.endsWith('/api/auth/service')
        ? json({ accessToken: ttl15m() })
        : json({ status: 'ok', issues: [] }),
    );
    await client.getHealth();
    await client.getHealth();
    const paths = calls.map(c => new URL(c.url).pathname);
    expect(paths).toEqual(['/api/auth/service', '/api/health', '/api/health']);
    expect(
      calls.every(c => c.init?.method !== 'DELETE' && c.init?.method !== 'PUT'),
    ).toBe(true);
  });

  it('비밀번호는 토큰 발급 요청 본문에만 실리고 URL 에는 없다', async () => {
    const client = make(url =>
      url.endsWith('/api/auth/service')
        ? json({ accessToken: ttl15m() })
        : json({ status: 'ok' }),
    );
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
    const client = make(url =>
      url.endsWith('/api/auth/service')
        ? json({ accessToken: ttl15m() })
        : json({ status: 'ok' }),
    );
    await client.getHealth();
    now = t0 + 14 * 60_000 + 30_000; // 만료까지 30초 남음
    await client.getHealth();
    expect(calls.filter(c => c.url.endsWith('/api/auth/service'))).toHaveLength(
      2,
    );
  });

  it('health 가 401 이면 토큰을 새로 받아 한 번만 다시 시도한다', async () => {
    let healthCalls = 0;
    const client = make(url => {
      if (url.endsWith('/api/auth/service'))
        return json({ accessToken: ttl15m() });
      return ++healthCalls === 1
        ? json({}, 401)
        : json({ status: 'warn', issues: ['x'] });
    });
    await expect(client.getHealth()).resolves.toEqual({
      status: 'warn',
      issues: ['x'],
    });
    expect(calls.filter(c => c.url.endsWith('/api/auth/service'))).toHaveLength(
      2,
    );
  });

  it('다시 시도해도 401 이면 unauthorized', async () => {
    const client = make(url =>
      url.endsWith('/api/auth/service')
        ? json({ accessToken: ttl15m() })
        : json({}, 401),
    );
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
    const client = make(url =>
      url.endsWith('/api/auth/service')
        ? json({ accessToken: ttl15m() })
        : json({}, 500),
    );
    await expect(client.getHealth()).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });
});
