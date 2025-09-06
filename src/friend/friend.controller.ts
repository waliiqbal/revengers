/* eslint-disable prettier/prettier */
import { Controller, Get, Param, Put, Delete, Body, Req, Patch , Post, Query, Search} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { FriendService } from './friend.service';

@Controller('Friend')
export class FriendController {
  constructor(private readonly FriendService: FriendService) {}

@UseGuards(AuthGuard('jwt'))
@Post('send-friend-request')
async sendFriendRequest(@Body() body: any, @Req() req) {
  const senderId = req.user.userId;       // token se sender id
  const receiverId = body.id;     // body se receiver id

  return this.FriendService.sendFriendRequest(senderId, receiverId);
}

@UseGuards(AuthGuard('jwt'))
  @Post('accept-request')
  async acceptRequest(@Req() req, @Body() body: any) {
    
    const receiverId = req.user.userId;

    return this.FriendService.acceptRequest(receiverId, body);

  }

   @UseGuards(AuthGuard('jwt'))
  @Get('getRequests')
  async getFriendRequests(
    @Req() req: any, // request object, JWT decoded user info milega
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    
  ) {
    const userId = req.user.userId; 

     const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.FriendService.getFriendRequests(userId, type, pageNumber, limitNumber);
  }


@UseGuards(AuthGuard('jwt'))
@Post('decline-request-by-sender')
async declineRequest(@Req() req, @Body() body: any) {
  const senderId = req.user.userId;
  const receiverId = body.id;

  

  return this.FriendService.declineFriendRequest(senderId, receiverId);
}

 @UseGuards(AuthGuard('jwt'))
  @Get('getfriends')
  async getFriend(
    @Req() req: any, // request object, JWT decoded user info milega
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    
  ) {
    const userId = req.user.userId; 

     const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.FriendService.getFriends(userId, pageNumber, limitNumber, search);

  }
  
   @UseGuards(AuthGuard('jwt'))
  @Get('getAllUsers')
  async getAllUsers(
    @Req() req: any, // request object, JWT decoded user info milega
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    
  ) {
    const currentUserId = req.user.userId; 

     const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.FriendService.getAllUsers(currentUserId, pageNumber, limitNumber, search);

  }

  @UseGuards(AuthGuard('jwt'))
@Post('remove-Friends')
async removeFriends(@Req() req, @Body() body: any) {
  const currentUserId = req.user.userId;
  const otherUserId = body.id;

  

  return this.FriendService.removeFriend(currentUserId, otherUserId);
}
  }