export interface Config {
  /** BotMng 연동 설정. 값은 환경 변수로만 받는다. */
  botmng?: {
    /** BotMng 주소 (예: https://botmng.example.com) */
    baseUrl?: string;
    /**
     * BotMng 서비스 계정(devmng) 비밀번호.
     * @visibility secret
     */
    servicePassword?: string;
  };
}
