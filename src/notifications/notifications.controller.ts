/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { PaginationQueryDto } from '../admin/dto/admin-query.dto';
import { NotificationsService } from './notifications.service';
import { NotificationAudienceDto, SendNotificationDto } from './dto/send-notification.dto';

// 🔔 Admin dashboard → Notifications tab (push via Firebase, email via SMTP)
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Is push / email set up, and how many players each can reach' })
  async status() {
    return this.notifications.status();
  }

  @Post('preview')
  @ApiOperation({ summary: 'How many players a notification would reach' })
  @ApiBody({ type: NotificationAudienceDto })
  async preview(@Body() body: NotificationAudienceDto) {
    return this.notifications.preview(body);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a push notification or email to all players or selected players (runs in the background)' })
  @ApiBody({ type: SendNotificationDto })
  async send(@Req() req, @Body() body: SendNotificationDto) {
    return this.notifications.send(req.user.userId, body);
  }

  @Get('history')
  @ApiOperation({ summary: 'Notifications sent from the dashboard, newest first' })
  async history(@Query() query: PaginationQueryDto) {
    return this.notifications.history(query.page, query.limit);
  }
}
