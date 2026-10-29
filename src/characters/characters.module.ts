/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AdminAscensionController, CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  controllers: [CharactersController, AdminAscensionController],
  providers: [CharactersService],
})
export class CharactersModule {}
