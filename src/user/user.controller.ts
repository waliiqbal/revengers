/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Body,
  Req,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { FcmTokenDto } from './dto/fcm-token.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('getProfile')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get logged-in user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile fetched successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.getProfile(userId);
  }

  @Post('update-user')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update logged-in user data' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateUser(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.userId;
    return this.usersService.updateUserData(userId, updateUserDto);
  }

  // 🔔 Firebase device token — game login ke baad aur token badalne pe bhejta hai (push notifications ke liye)
  @Post('fcm-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Save the device push token (Firebase Cloud Messaging) for the logged-in player' })
  @ApiBody({ type: FcmTokenDto })
  async saveFcmToken(@Req() req, @Body() body: FcmTokenDto) {
    return this.usersService.saveFcmToken(req.user.userId, body.fcmToken);
  }
}
