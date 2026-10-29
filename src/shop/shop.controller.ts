/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { ShopService } from './shop.service';
import { UpdateShopItemDto } from './dto/shop.dto';

// 🎮 Game ka Store screen yahan se cards ki values leta hai (login ke bina bhi chal jata hai)
@ApiTags('Shop')
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Store cards for the game: coins (real money, in-app IDs), gems (paid with coins), diamonds (paid with gems), weapons' })
  async catalog() {
    return this.shopService.catalog();
  }
}

// 🔐 Admin dashboard: Store tab
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/shop')
export class AdminShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  @ApiOperation({ summary: 'All store cards grouped by tab, with in-app product IDs' })
  async list() {
    return this.shopService.adminList();
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Edit one store card (title, amount, price, in-app IDs, on/off). The game shows it the next time the Store opens.' })
  @ApiBody({ type: UpdateShopItemDto })
  async update(@Req() req, @Param('id') id: string, @Body() body: UpdateShopItemDto) {
    return this.shopService.update(req.user.userId, id, body);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Put every card back to the values from the game screens (in-app product IDs are kept)' })
  async reset(@Req() req) {
    return this.shopService.resetToDefaults(req.user.userId);
  }
}
