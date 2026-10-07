import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  /** 서비스가 요청을 받을 준비가 되었는지 알리는 용도 (Docker HEALTHCHECK 가 사용) */
  @Get()
  check() {
    return { status: "ok" };
  }
}
