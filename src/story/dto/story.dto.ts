/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Length, Min } from 'class-validator';

export class StartStageDto {
  @ApiProperty({ example: 1, description: 'Stage number (Level_1 = 1)' })
  @IsInt()
  @Min(1)
  stage: number;
}

export class CompleteStageDto {
  @ApiProperty({ description: 'runId returned by /story/start' })
  @IsString()
  @Length(1, 64)
  runId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  won: boolean;
}
