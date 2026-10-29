/* eslint-disable prettier/prettier */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

// App Store / Google Play product IDs: letters, numbers, dot and underscore (e.g. com.tokyorevengers.game.coins_100)
const PRODUCT_ID = /^$|^[A-Za-z0-9][A-Za-z0-9._]{0,99}$/;

export class UpdateShopItemDto {
  @ApiPropertyOptional({ example: 'Bundle 1' })
  @IsOptional() @IsString() @MaxLength(40)
  title?: string;

  @ApiPropertyOptional({ example: 100, description: 'Coins / gems / diamonds the player gets' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000)
  amount?: number;

  @ApiPropertyOptional({ example: '' })
  @IsOptional() @IsString() @MaxLength(80)
  description?: string;

  @ApiPropertyOptional({ example: 4.99, description: 'USD for the Coins tab, otherwise coins / gems / diamonds' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000)
  price?: number;

  @ApiPropertyOptional({ example: 'com.tokyorevengers.game.coins_100' })
  @IsOptional() @IsString() @Matches(PRODUCT_ID, { message: 'iOS product ID may only use letters, numbers, "." and "_"' })
  iosProductId?: string;

  @ApiPropertyOptional({ example: 'com.tokyorevengers.game.coins_100' })
  @IsOptional() @IsString() @Matches(PRODUCT_ID, { message: 'Android product ID may only use letters, numbers, "." and "_"' })
  androidProductId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  active?: boolean;
}
