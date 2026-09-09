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
}
