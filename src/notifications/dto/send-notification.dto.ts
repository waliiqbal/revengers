/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class NotificationAudienceDto {
  @ApiProperty({ enum: ['push', 'email'] })
  @IsIn(['push', 'email'])
  channel: string;

  @ApiProperty({ enum: ['all', 'players'], description: 'all = every active player, players = only userIds' })
  @IsIn(['all', 'players'])
  audience: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsMongoId({ each: true })
  userIds?: string[];
}

export class SendNotificationDto extends NotificationAudienceDto {
  @ApiProperty({ example: 'Double coins this weekend!' })
  @IsString()
  @Length(1, 120)
  title: string;

  @ApiProperty({ example: 'Play any multiplayer match before Sunday to earn double coins.' })
  @IsString()
  @Length(1, 3000)
  body: string;
}
