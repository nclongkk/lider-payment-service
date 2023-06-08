import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class RequestPaymentDto {
  @ApiProperty({ type: Number })
  @Transform(({ value }) => Math.round(value * 100) / 100)
  @IsNotEmpty()
  @IsNumber()
  @Max(100000)
  @Min(10, { message: 'Minimum amount is 10' })
  amount: number;
}
