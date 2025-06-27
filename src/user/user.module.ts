/* eslint-disable prettier/prettier */
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './user.service';
import { UsersController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/user.schema';
import { RolesGuard } from '../auth/guard/roles.guard'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema }
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService,  RolesGuard],
  exports: [UsersService], 
})
export class UsersModule {}