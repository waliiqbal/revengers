/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,

  
} from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/createItem.dto'

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ✅ 1. Create store item (admin panel or setup)
  @Post('addCharacter')
   async createStore(@Body() body: CreateStoreDto) {
    return await this.storeService.createStoreItems(body);
  }


  @Patch('unlock-character')
async unlockCharacter(@Body() body: any) {
  return this.storeService.unlockCharacter(body);
}

@Get('getCharacter')
async listAllStoreItems() {
  return await this.storeService.listAllStoreItems();
}
}

