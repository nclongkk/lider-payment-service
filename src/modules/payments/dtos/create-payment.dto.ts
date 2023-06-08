import { IsDate, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { PaymentStatus } from 'src/constants/payment.constants';

export class CreatePaymentDto {
  @IsString()
  method: string;

  @IsString()
  methodId?: string;

  @IsString()
  action?: string;

  @IsString()
  description?: string;

  @IsString()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  transactionId?: string;

  @IsString()
  orderId?: string;

  @IsDate()
  paymentDate: Date;

  isResolved?: boolean;
  status?: PaymentStatus;
  paymentBy?: Types.ObjectId;
}
