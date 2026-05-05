/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class FriendUserIdDto {
  @ApiProperty({
    example: '662f7f8b3a4f123456789abc',
    description: 'Other user id',
  })
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}