/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsNumber,
  IsString,
} from "class-validator";

export class CreateItemsDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  image: string;

  @IsNotEmpty()
  @IsString()
  shortCode: string;

  @IsNotEmpty()
  @IsString()
  itemType: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;
}
