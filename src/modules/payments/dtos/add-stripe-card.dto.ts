import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddStripCardDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  cardName?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @ApiProperty()
  @IsNumber()
  expMonth: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  expYear: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cvc: string;
}
