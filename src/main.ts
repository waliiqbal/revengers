import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 🖥️ Admin dashboard (public/admin-panel) → http://<server>:3002/admin-panel/
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Revengers API')
    .setDescription('API documentation for Revengers backend')
    .setVersion('1.0')
    .addBearerAuth() // 🔐 JWT support
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // token save rahega
    },
  });

  await app.listen(3002);

  console.log(`🚀 Server: http://localhost:3002`);
  console.log(`📘 Swagger: http://localhost:3002/api-docs`);
  console.log(`🖥️  Admin:   http://localhost:3002/admin-panel/`);
}
bootstrap();