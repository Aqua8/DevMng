import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  // 기본은 내 컴퓨터에서만 접속된다. 컨테이너에서는 Dockerfile 이 HOST=0.0.0.0 으로 바꾼다.
  const host = process.env.HOST ?? "127.0.0.1";
  await app.listen(port, host);
}

void bootstrap();
