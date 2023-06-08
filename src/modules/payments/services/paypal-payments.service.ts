import { BadRequestException, Injectable } from '@nestjs/common';
import { PaypalService } from 'src/shared/services/payments';
import * as _ from 'lodash';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../../constants/payment.constants';
import { AppRepository } from '../../../database/app.repository';
import { Payment } from '../../../database/schemas';
import { TRANSACTION_TYPE } from '../constants/payment.constants';
import { RequestPaymentDto } from '../dtos/request-payment.dto';

@Injectable()
export class PaypalPaymentsService {
  constructor(
    private readonly paypalService: PaypalService,
    private readonly appRepository: AppRepository,
  ) {}
  async createOrder(orderData: any) {
    // return this.paypalService.createOrder(orderData);
  }

  async capturePaymentOrder(orderId: string) {
    return this.paypalService.capturePaymentOrder(orderId);
  }

  async getOrder(orderId: string) {
    return this.paypalService.getOrderData(orderId);
  }

  async getCapturePaymentDetail(captureId: string) {
    return this.paypalService.getCapturePaymentDetail(captureId);
  }

  async requestPayment({ amount }: RequestPaymentDto, authUser) {
    try {
      const user = await this.appRepository.user.getOne({
        where: { _id: authUser._id },
      });
      const data: Partial<Payment> = {
        userId: user._id,
        amount,
        operator: '+',
        type: TRANSACTION_TYPE.USER_TOP_UP,
        paymentMethod: PaymentMethod.PAYPAL,
        metadata: {
          service: 0.03,
          taxCharge: 0.03,
          amount,
          bankTransferAmount: 0.03,
        },
        status: PaymentStatus.PENDING,
      };
      const newTransaction = await this.appRepository.payment.createOne({
        data,
      });
      const order = await this.paypalService.createOrder({
        amount,
        transactionId: newTransaction._id,
        user,
      });

      await this.appRepository.payment.updateOne({
        where: {
          _id: newTransaction._id,
          status: PaymentStatus.PENDING,
        },
        data: {
          $set: {
            transactionId: order.id,
            'metadata.order': order,
          },
        },
      });

      return {
        orderId: order.id,
        amount,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async fulfillPaypalPayment(req, { orderId, user: authUser }) {
    try {
      const transaction = await this.appRepository.payment.getOne({
        where: {
          userId: authUser._id,
          transactionId: orderId,
          type: TRANSACTION_TYPE.USER_TOP_UP,
          paymentMethod: PaymentMethod.PAYPAL,
          status: PaymentStatus.PENDING,
        },
      });

      if (!transaction) {
        return;
      }

      const user = await this.appRepository.user.getOne({
        where: {
          _id: authUser._id,
        },
      });

      let order = await this.paypalService.getOrderDetail({
        orderId,
      });
      if (_.get(order, 'status') === 'APPROVED') {
        try {
          order = await this.paypalService.capturePayment({ orderId });
        } catch (err) {
          throw new Error(
            'Your transaction is in holding status. Please contact our support team for more information.',
          );
        }
      }

      await this.appRepository.payment.updateOne({
        where: {
          _id: transaction._id,
          status: PaymentStatus.PENDING,
        },
        data: {
          $set: {
            status: PaymentStatus.SUCCEEDED,
          },
        },
      });

      await this.appRepository.user.updateOne({
        where: { _id: user._id },
        data: {
          $inc: { deposit: transaction.amount },
        },
      });
      return order;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }
}
