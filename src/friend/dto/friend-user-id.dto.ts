/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class FriendUserIdDto {
  @ApiProperty({
    example: '662f7f8b3a4f123456789abc',
    description: 'Other user id',
  })
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}

// accept-request: the game sends id (= the player who sent the request) + type
export class FriendRespondDto extends FriendUserIdDto {
  @ApiPropertyOptional({ enum: ['accept', 'reject', 'decline'], example: 'accept' })
  @IsOptional()
  @IsIn(['accept', 'reject', 'decline'])
  type?: string;
}
