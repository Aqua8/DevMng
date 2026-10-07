/* eslint-disable no-restricted-imports -- 이 테스트만 Node(jest)에서 카탈로그 파일을 읽는다. 브라우저 코드에는 쓰지 않는다 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BOTMNG_HEALTH_ANNOTATION, botmngPlugin } from './plugin';

describe('botmng', () => {
  it('플러그인을 내보낸다', () => {
    expect(botmngPlugin).toBeDefined();
  });
  it('주석 키가 유효한 형식이다', () => {
    expect(BOTMNG_HEALTH_ANNOTATION).toMatch(/^[a-z0-9.-]+\/[a-z0-9-]+$/);
  });
  it('카탈로그의 botmng 컴포넌트가 같은 주석 키를 쓴다 (오타가 나면 카드가 조용히 사라진다)', () => {
    const yaml = readFileSync(
      resolve(__dirname, '../../../catalog/components.yaml'),
      'utf8',
    );
    // 문서(---)별로 나눠서 name: botmng 인 컴포넌트 안에 주석이 있어야 한다
    const botmng = yaml
      .split(/^---$/m)
      .find(doc => /^ {2}name: botmng$/m.test(doc));
    expect(botmng).toBeDefined();
    expect(botmng).toContain(`${BOTMNG_HEALTH_ANNOTATION}: 'true'`);
  });
});
