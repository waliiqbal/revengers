/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { SupportService } from './support.service';
import {
  AdminTicketQueryDto,
  AdminTicketReplyDto,
  CreateTicketDto,
  TicketPageQueryDto,
  TicketReplyDto,
  TicketStatusDto,
} from './dto/support.dto';

// 🎮 Game se: player feedback / bug report / support request bhejta hai aur jawab dekhta hai
@ApiTags('Support')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(AuthGuard('jwt'))
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Send feedback, a bug report or a support request' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 429, description: 'Too many requests today' })
  async create(@Req() req, @Body() body: CreateTicketDto) {
    return this.supportService.createTicket(req.user.userId, body);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'My support requests, newest activity first (includes unreadCount)' })
  async list(@Req() req, @Query() query: TicketPageQueryDto) {
    return this.supportService.listMyTickets(req.user.userId, query);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'One of my support requests with the full conversation (marks replies as read)' })
  async get(@Req() req, @Param('id') id: string) {
    return this.supportService.getMyTicket(req.user.userId, id);
  }

  @Post('tickets/:id/reply')
  @ApiOperation({ summary: 'Add a message to my support request (reopens it if it was resolved)' })
  @ApiBody({ type: TicketReplyDto })
  async reply(@Req() req, @Param('id') id: string, @Body() body: TicketReplyDto) {
    return this.supportService.playerReply(req.user.userId, id, body.message);
  }
}

// 🔐 Admin dashboard se: saare tickets dekhna, jawab dena, status badalna
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Ticket counts by status, and how many have unread player messages' })
  async stats() {
    return this.supportService.adminStats();
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets (unread first) with status / category filters and search' })
  async list(@Query() query: AdminTicketQueryDto) {
    return this.supportService.adminList(query);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'One ticket with the full conversation and player info (marks it read)' })
  async get(@Param('id') id: string) {
    return this.supportService.adminGet(id);
  }

  @Post('tickets/:id/reply')
  @ApiOperation({ summary: 'Reply to the player (sends a push notification if the player has a device token)' })
  @ApiBody({ type: AdminTicketReplyDto })
  async reply(@Req() req, @Param('id') id: string, @Body() body: AdminTicketReplyDto) {
    return this.supportService.adminReply(req.user.userId, id, body.message, body.status);
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Change ticket status (open, in_progress, resolved, closed)' })
  @ApiBody({ type: TicketStatusDto })
  async status(@Param('id') id: string, @Body() body: TicketStatusDto) {
    return this.supportService.adminSetStatus(id, body.status);
  }
}
