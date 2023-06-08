import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
class PaymentMethod {
  @Prop({ type: String })
  id: string;

  @Prop({ type: String })
  fingerprint: string;

  @Prop({ type: Object })
  billingDetails: any;

  @Prop({ type: Date })
  removedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;
}
const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

@Schema({ _id: false })
class StripeBilling {
  @Prop({ type: String })
  customerId: string;

  @Prop({ type: Date })
  connectedAt: Date;

  @Prop({ type: [PaymentMethodSchema] })
  paymentMethods: [PaymentMethod];
}
const StripeBillingSchema = SchemaFactory.createForClass(StripeBilling);

@Schema({ _id: false })
class PaypalBilling {
  @Prop({ type: Object })
  linkedAccounts: any;
}
const PaypalBillingSchema = SchemaFactory.createForClass(PaypalBilling);

@Schema({ _id: false })
export class Billings {
  @Prop({ type: StripeBillingSchema })
  stripe: StripeBilling;

  @Prop({ type: PaypalBillingSchema })
  paypal: PaypalBilling;
}

export const BillingsSchema = SchemaFactory.createForClass(Billings);

@Schema({ timestamps: true })
export class User {
  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: BillingsSchema })
  billings?: Billings;

  @Prop({ required: true, type: Number, default: 0 })
  deposit?: number;
}

const schema = SchemaFactory.createForClass(User);
schema.index({ 'billings.stripe.customerId': 1 }, { unique: true });

export const UserSchema = schema;
