import { mockServices } from '@backstage/backend-test-utils';
import { isSafeBaseUrl, readBotmngConfig } from './botmngConfig';

const read = (botmng?: Record<string, string>) =>
  readBotmngConfig(mockServices.rootConfig({ data: botmng ? { botmng } : {} }));

describe('readBotmngConfig', () => {
  it('두 값이 모두 있으면 돌려준다', () => {
    expect(
      read({ baseUrl: 'https://botmng.test', servicePassword: 'pw' }),
    ).toEqual({
      baseUrl: 'https://botmng.test',
      password: 'pw',
    });
  });
  it('설정이 없으면 undefined', () => {
    expect(read()).toBeUndefined();
    expect(read({ baseUrl: 'https://botmng.test' })).toBeUndefined();
  });
  it('빈 문자열(compose가 비워 둔 환경 변수)은 예외 없이 설정 없음으로 본다', () => {
    expect(read({ baseUrl: '', servicePassword: '' })).toBeUndefined();
    expect(
      read({ baseUrl: 'https://botmng.test', servicePassword: '' }),
    ).toBeUndefined();
  });
});

describe('isSafeBaseUrl', () => {
  it('https 는 허용한다', () => {
    expect(isSafeBaseUrl('https://botmng.example.com')).toBe(true);
  });
  it('http 는 내 컴퓨터로 향할 때만 허용한다', () => {
    expect(isSafeBaseUrl('http://localhost:3000')).toBe(true);
    expect(isSafeBaseUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isSafeBaseUrl('http://host.docker.internal:3000')).toBe(true);
    expect(isSafeBaseUrl('http://botmng.example.com')).toBe(false);
    expect(isSafeBaseUrl('http://203.0.113.5:3000')).toBe(false);
  });
  it('다른 형식은 거부한다', () => {
    expect(isSafeBaseUrl('ftp://localhost')).toBe(false);
    expect(isSafeBaseUrl('not a url')).toBe(false);
  });
});

describe('readBotmngConfig 주소 검사', () => {
  it('평문 http 공개 주소는 비밀번호를 보내지 않도록 설정 없음으로 본다', () => {
    expect(
      read({ baseUrl: 'http://botmng.example.com', servicePassword: 'pw' }),
    ).toBeUndefined();
  });
});
