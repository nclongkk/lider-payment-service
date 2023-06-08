import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PaginationParam } from 'src/shared/interfaces';
import { PaymentStatus } from 'src/constants/payment.constants';
import { parseObjectId } from 'src/shared/utils/mongoose.util';
import { ISortOrder } from 'src/shared/interfaces/sort.interface';
import { AppRepository } from 'src/database/app.repository';
import { PaymentFilter } from '../interfaces/payment-filter';
import { ChargeServiceFeeDto } from '../dtos/charge-service-fee.dto';
import { TRANSACTION_TYPE } from '../constants/payment.constants';
import * as mongoose from 'mongoose';

@Injectable()
export class PaymentsService {
  constructor(private readonly appRepository: AppRepository) {}

  create(createPaymentDto: CreatePaymentDto, paymentBy: string) {
    return this.appRepository.payment.createOne({
      data: { ...createPaymentDto, paymentBy: parseObjectId(paymentBy) },
    });
  }

  findPaymentsByCurrentUser(
    paginationParam: PaginationParam,
    sort: ISortOrder,
    query: PaymentFilter,
  ) {
    return this.appRepository.payment.getAllWithPaging(query, paginationParam);
  }

  async markPaymentSuccess(paymentId) {
    return this.appRepository.payment.findOneAndUpdate({
      where: { _id: parseObjectId(paymentId) },
      data: {
        isResolved: true,
        status: PaymentStatus.SUCCEEDED,
      },
    });
  }

  async markPaymentFailed(paymentId) {
    return this.appRepository.payment.findOneAndUpdate({
      where: { _id: parseObjectId(paymentId) },
      data: {
        isResolved: true,
        status: PaymentStatus.FAILED,
      },
    });
  }

  async getPaymentUser(userId) {
    return this.appRepository.user.getOne({
      where: { _id: userId },
    });
  }

  async chargeServiceFee(chargeServiceFee: ChargeServiceFeeDto) {
    const user = await this.appRepository.user.getOne({
      where: { _id: parseObjectId(chargeServiceFee.userId) },
      select: '_id deposit',
    });

    if (!user) {
      throw new BadRequestException('error.user_not_found');
    }

    if (user.deposit < chargeServiceFee.amount) {
      throw new BadRequestException('error.not_enough_deposit');
    }

    await this.appRepository.user.updateOne({
      where: { _id: parseObjectId(chargeServiceFee.userId) },
      data: {
        deposit: user.deposit - chargeServiceFee.amount,
      },
    });

    const newId = new mongoose.Types.ObjectId();
    return this.appRepository.payment.createOne({
      data: {
        _id: newId,
        userId: parseObjectId(chargeServiceFee.userId),
        amount: chargeServiceFee.amount,
        description: 'service_fee',
        type: TRANSACTION_TYPE.SERVICE_CHARGE,
        status: PaymentStatus.SUCCEEDED,
        operator: '-',
        metadata: {
          meetingId: chargeServiceFee.meetingId,
        },
        transactionId: newId.toString(),
      },
    });
  }
}
