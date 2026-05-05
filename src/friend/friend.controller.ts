/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Body,
  Req,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FriendService } from './friend.service';
import { FriendUserIdDto } from './dto/friend-user-id.dto';

@ApiTags('Friend')
@ApiBearerAuth()
@Controller('Friend')
export class FriendController {
  constructor(private readonly FriendService: FriendService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('send-friend-request')
  @ApiOperation({ summary: 'Send friend request' })
  @ApiBody({ type: FriendUserIdDto })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendFriendRequest(@Body() body: FriendUserIdDto, @Req() req) {
    const senderId = req.user.userId;
    const receiverId = body.id;

    return this.FriendService.sendFriendRequest(senderId, receiverId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('accept-request')
  @ApiOperation({ summary: 'Accept friend request' })
  @ApiBody({ type: FriendUserIdDto })
  @ApiResponse({ status: 201, description: 'Friend request accepted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acceptRequest(@Req() req, @Body() body: FriendUserIdDto) {
    const receiverId = req.user.userId;

    return this.FriendService.acceptRequest(receiverId, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('getRequests')
  @ApiOperation({ summary: 'Get friend requests' })
  @ApiQuery({
    name: 'type',
    required: false,
    example: 'pending',
    description: 'Request type/status filter',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Friend requests fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendRequests(
    @Req() req: any,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.user.userId;

    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;

    return this.FriendService.getFriendRequests(
      userId,
      type,
      pageNumber,
      limitNumber,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('decline-request-by-sender')
  @ApiOperation({ summary: 'Decline or cancel friend request' })
  @ApiBody({ type: FriendUserIdDto })
  @ApiResponse({ status: 201, description: 'Friend request declined successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async declineRequest(@Req() req, @Body() body: FriendUserIdDto) {
    const senderId = req.user.userId;
    const receiverId = body.id;

    return this.FriendService.declineFriendRequest(senderId, receiverId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('getfriends')
  @ApiOperation({ summary: 'Get logged-in user friends' })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'huzaifa',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Friends fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriend(
    @Req() req: any,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.user.userId;

    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;

    return this.FriendService.getFriends(
      userId,
      pageNumber,
      limitNumber,
      search,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('getAllUsers')
  @ApiOperation({ summary: 'Get all users except logged-in user' })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'ali',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Users fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllUsers(
    @Req() req: any,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const currentUserId = req.user.userId;

    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;

    return this.FriendService.getAllUsers(
      currentUserId,
      pageNumber,
      limitNumber,
      search,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('remove-Friends')
  @ApiOperation({ summary: 'Remove friend' })
  @ApiBody({ type: FriendUserIdDto })
  @ApiResponse({ status: 201, description: 'Friend removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeFriends(@Req() req, @Body() body: FriendUserIdDto) {
    const currentUserId = req.user.userId;
    const otherUserId = body.id;

    return this.FriendService.removeFriend(currentUserId, otherUserId);
  }
}