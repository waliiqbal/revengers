/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Req

  
} from '@nestjs/common';
import { paymentService } from './payment.service';
import {PurchaseItemDto} from "../payment/dto/purchase-item.dto"
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';


@Controller('payment')
export class paymentController {
  constructor(private readonly paymentService: paymentService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('purchase-item')
  async purchaseItem(@Body() purchaseItemDto: PurchaseItemDto, @Req() req) {
    const userId = req.user.userId; 
    return this.paymentService.purchaseItem(userId, purchaseItemDto);
  }
}


