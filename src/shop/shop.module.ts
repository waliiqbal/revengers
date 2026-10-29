/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AdminShopController, ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController, AdminShopController],
  providers: [ShopService],
})
export class ShopModule {}
