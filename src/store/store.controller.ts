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
  @Post('createStore')
   async createStore(@Body() body: CreateStoreDto) {
    return await this.storeService.createStoreItems(body);
  }

@Get('all-store-item')
async listAllStoreItems() {
  return await this.storeService.listAllStoreItems();
}
}

