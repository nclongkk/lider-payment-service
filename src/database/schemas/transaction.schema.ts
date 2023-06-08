import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { PaymentStatus, PaymentMethod } from 'src/constants/payment.constants';
import { TRANSACTION_TYPE } from '../../modules/payments/constants/payment.constants';
import { Log, LogSchema } from './log.schema';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  timestamps: true,
})
export class Payment {
  _id: Types.ObjectId | string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  customId: string;

  @Prop({ maxlength: 100, enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Prop({ type: String, enum: ['+', '-', 'none'], required: true })
  operator: '+' | '-' | 'none';

  @Prop({ type: String, enum: TRANSACTION_TYPE, required: true })
  type: TRANSACTION_TYPE;

  @Prop({ maxlength: 2000 })
  description: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: Object })
  metadata: any;

  @Prop({ required: true })
  status: PaymentStatus;

  @Prop({ type: [LogSchema] })
  logs?: Log[];

  @Prop({ type: String })
  transactionId?: string;
}

const schema = SchemaFactory.createForClass(Payment);
schema.index({ userId: 1 });
export const TransactionSchema = schema;
