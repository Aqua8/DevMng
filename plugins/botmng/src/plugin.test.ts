import { BOTMNG_HEALTH_ANNOTATION, botmngPlugin } from './plugin';

describe('botmng', () => {
  it('플러그인을 내보낸다', () => {
    expect(botmngPlugin).toBeDefined();
  });
  it('주석 키가 유효한 형식이다', () => {
    expect(BOTMNG_HEALTH_ANNOTATION).toMatch(/^[a-z0-9.-]+\/[a-z0-9-]+$/);
  });
});
