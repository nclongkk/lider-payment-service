import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { BaseRepository } from '../../base/base.repository';
import { Payment, PaymentDocument } from '../schemas';
import { PaginationParam } from 'src/shared/interfaces';
import { ISortOrder } from 'src/shared/interfaces/sort.interface';
import { PaymentFilter } from 'src/modules/payments/interfaces/payment-filter';

@Injectable()
export class TransactionRepository extends BaseRepository<PaymentDocument> {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {
    super(paymentModel);
  }
  async searchPayments(
    paginationParam: PaginationParam,
    sort: ISortOrder,
    query: PaymentFilter,
  ) {
    return this.getAll();
  }
}
