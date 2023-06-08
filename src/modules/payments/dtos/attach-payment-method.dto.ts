import { IsNotEmpty, IsString } from 'class-validator';

export class AttachPaymentMethodDto {
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;
}
