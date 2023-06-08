import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ChargeServiceFeeDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  meetingId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;
}
