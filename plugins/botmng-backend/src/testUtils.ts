/** 테스트에서 공유하는 고정 시각과 가짜 클라이언트 */
export const NOW = new Date('2026-10-07T00:00:00Z');

/** getHealth 가 항상 err 를 던지는 가짜 BotMng 클라이언트 */
export const failingClient = (err: unknown) => ({
  getHealth: async () => {
    throw err;
  },
});
