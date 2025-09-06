/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Req,Patch, Param, Query, Get } from "@nestjs/common";
import { ClanService } from "./clan.service";
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from "@nestjs/common";


@Controller("clan")
export class ClanController {
  constructor(private readonly ClanService: ClanService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post("createClan")
  async createClan(@Body() body, @Req() req) {
    const userId = req.user.userId; // JWT se userId
    console.log(userId)
    return this.ClanService.createClan(body, userId); // pura response service se aayega
  }

  @UseGuards(AuthGuard('jwt'))
 @UseGuards(AuthGuard('jwt'))
  @Post("sendRequest")
    async sendRequest(@Body("clanId") clanId: string, @Req() req) {
    const userId = req.user.userId; // JWT se aya user
    return this.ClanService.sendClanRequest(clanId, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post("handle-clan-request")
async handleClanRequest(
  @Body("requestId") requestId: string,
  @Body("type") type: string,
  @Req() req
) {
  const leaderId = req.user.userId; 
  return this.ClanService.handleClanRequest(requestId, leaderId, type);
}
    @UseGuards(AuthGuard('jwt'))
  @Post("decline-clan-request-by-sender")
async declineClanRequest(
  @Body("requestId") requestId: string,
  
  @Req() req
) {
  const senderId = req.user.userId; 
  return this.ClanService.declineClanRequestBySender(requestId , senderId );
}
  @UseGuards(AuthGuard('jwt'))
  @Get('getClanRequests')
  async getClanRequests(
    @Req() req: any, // request object, JWT decoded user info milega
    @Query('clanId') clanId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    
  ) {
    const userId = req.user.userId; 

     const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.ClanService.getClanRequests( clanId, userId , pageNumber, limitNumber);
  }

    @UseGuards(AuthGuard('jwt'))
  @Get('getClanFriends')
  async getClanFriends(
    @Req() req: any, // request object, JWT decoded user info milega
    @Query('clanId') clanId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    
  ) {
    const userId = req.user.userId; 

     const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.ClanService.getClanFriends( clanId, userId , pageNumber, limitNumber);
  }
}