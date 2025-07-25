/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './payment.schema'
import { paymentController } from './payment.controller'
import { paymentService } from './payment.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }])],
  controllers: [paymentController],
  providers: [paymentService],
  exports: [paymentService], 
})
export class paymentModule {}
