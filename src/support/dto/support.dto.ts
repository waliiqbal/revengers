/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TICKET_CATEGORIES, TICKET_STATUSES } from '../support-ticket.schema';

export class CreateTicketDto {
  @ApiProperty({ enum: TICKET_CATEGORIES, example: 'bug' })
  @IsIn(TICKET_CATEGORIES)
  category: string;

  @ApiProperty({ example: 'Game freezes after a ranked match' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject: string;

  @ApiProperty({ example: 'When the match ends the result screen never shows and I have to restart.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ example: '1.0.4' })
  @IsOptional() @IsString() @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional({ example: 'Android' })
  @IsOptional() @IsString() @MaxLength(40)
  platform?: string;

  @ApiPropertyOptional({ example: 'Samsung SM-A515F' })
  @IsOptional() @IsString() @MaxLength(80)
  deviceModel?: string;
}

export class TicketReplyDto {
  @ApiProperty({ example: 'Thanks, it happened again today.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

export class AdminTicketReplyDto extends TicketReplyDto {
  @ApiPropertyOptional({ enum: TICKET_STATUSES, description: 'Optionally change the status in the same step' })
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: string;
}

export class TicketStatusDto {
  @ApiProperty({ enum: TICKET_STATUSES })
  @IsIn(TICKET_STATUSES)
  status: string;
}

export class TicketPageQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class AdminTicketQueryDto extends TicketPageQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'active', ...TICKET_STATUSES], default: 'active', description: 'active = open + in progress' })
  @IsOptional()
  @IsIn(['all', 'active', ...TICKET_STATUSES])
  status?: string = 'active';

  @ApiPropertyOptional({ enum: ['all', ...TICKET_CATEGORIES], default: 'all' })
  @IsOptional()
  @IsIn(['all', ...TICKET_CATEGORIES])
  category?: string = 'all';

  @ApiPropertyOptional({ description: 'Search subject, player name or email' })
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}
