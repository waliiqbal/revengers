/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AdminAscensionController, AdminCharacterUnlockController, CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  controllers: [CharactersController, AdminAscensionController, AdminCharacterUnlockController],
  providers: [CharactersService],
})
export class CharactersModule {}
