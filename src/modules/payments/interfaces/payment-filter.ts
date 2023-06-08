import { Types } from 'mongoose';

export interface PaymentFilter {
  paymentBy?: string | Types.ObjectId;
  method?: string;
  currency?: string;
  paymentIds?: string;
  searchKey?: string;
  userId?: string;
  email?: string;
  transactionId?: string;
  status?: string;
  from?: string;
  to?: string;
}
