/* eslint-disable prettier/prettier */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

const NumericStringToNumber = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return value;
    }

    return Number(value);
  });

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Huzaifa' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'test@gmail.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'https://image-url.com/profile.png' })
  @IsOptional()
  @IsString()
  displayPic?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  level?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  currentXp?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  totalXp?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  gem?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  diamond?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  coin?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  totalMatch?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  won?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  lost?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  kills?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  death?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  assists?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @NumericStringToNumber()
  @IsNumber()
  hours?: number;

  @ApiPropertyOptional({
    example: ['fire', 'speed', 'healing'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  availableSkill?: string[];
}
