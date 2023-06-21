import { TRANSACTION_TYPE } from './../constants/payment.constants';
import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as _ from 'lodash';
import {
  OTP_STRIPE_CARD_EXPIRED,
  PaymentAction,
  PaymentMethod,
  PaymentStatus,
  STRIPE_ACTIVE_CARD_FEE,
  StripeCaptureMethod,
  StripeCardStatus,
  StripePaymentCurrencySupported,
} from 'src/constants/payment.constants';
import { AddStripCardDto } from '../dtos/add-stripe-card.dto';

import moment from 'moment';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { StripeService } from 'src/shared/services/payments';
import { UserService } from 'src/modules/user/user.service';
import {
  convertToSmallestUnit,
  generateDescription,
} from 'src/shared/utils/payment.util';
import { generateActiveCardOTP } from 'src/shared/utils/common.util';
import { StripePaymentStatus } from 'src/shared/services/payments/stripe/stripe.interface';
import { AppRepository } from 'src/database/app.repository';
import { parseObjectId } from 'src/shared/utils/mongoose.util';
import { STRIPE_KEY } from '../../../shared/stripe-module/constants/stripe.constants';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { RequestPaymentDto } from '../dtos/request-payment.dto';
import { Payment } from '../../../database/schemas';

@Injectable()
export class StripePaymentsService {
  constructor(
    private readonly userService: UserService,
    private readonly stripeService: StripeService,
    private readonly appRepository: AppRepository,
    @Inject(STRIPE_KEY) private readonly stripe: Stripe,
  ) {}

  async findStripeCardsByUser(userId: string) {
    const user = await this.appRepository.user.getOne({
      where: {
        _id: userId,
      },
      select: 'billings.stripe',
    });
    const stripeCustomerId = user.billings?.stripe?.customerId;
    if (!stripeCustomerId) {
      return [];
    }

    const customer: any = await this.stripe.customers.retrieve(
      stripeCustomerId,
    );

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data.map((item) =>
      item.id === customer.invoice_settings.default_payment_method
        ? {
            ...item.card,
            paymentMethodId: item.id,
            default: true,
            verifiedAt: item.metadata?.verifiedAt,
          }
        : {
            ...item.card,
            paymentMethodId: item.id,
            default: false,
            verifiedAt: item.metadata?.verifiedAt,
          },
    );
  }

  async findStripeCardByPaymentId(paymentMethodId: string) {
    const paymentMethod: any = await this.stripeService.getPaymentMethod({
      paymentMethodId,
    });
    if (!paymentMethod || paymentMethod.httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(
        paymentMethod?.message ||
          'An error occurred while fetching payment method',
      );
    }
    const { id, customer, card, metadata } = paymentMethod;
    return { paymentMethodId: id, stripeCustomerId: customer, card, metadata };
  }

  async createStripeCustomerIfNotExists(user) {
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customerResponse: any =
        await this.stripeService.createStripeCustomer({
          options: {
            name: `${user.firstName} ${user.lastName || ''}`.trim(),
            email: user.email,
          },
        });

      if (!customerResponse || customerResponse.httpStatus !== HttpStatus.OK) {
        throw new BadRequestException(
          customerResponse?.message ||
            'An error occurred while creating customer',
        );
      }

      stripeCustomerId = customerResponse.id;
      await this.userService.updateUser(user.id, { stripeCustomerId });
    }
    return stripeCustomerId;
  }

  async createPaymentMethodForCustomerIfNotExists(
    customerId,
    addStripeCardDto: AddStripCardDto,
  ) {
    const cardResponse: any =
      await this.stripeService.createPaymentMethodForCustomer({
        card: {
          number: addStripeCardDto.cardNumber,
          exp_month: addStripeCardDto.expMonth,
          exp_year: addStripeCardDto.expYear,
          cvc: addStripeCardDto.cvc,
        },
        customerId,
        metadata: {
          country: addStripeCardDto?.country,
          status: StripeCardStatus.PENDING,
        },
        billingDetails: {
          name: addStripeCardDto?.cardName,
          email: addStripeCardDto?.email,
        },
      });

    if (!cardResponse || cardResponse.httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(
        cardResponse?.message ||
          'An error occurred while creating payment method',
      );
    }
    return cardResponse;
  }

  async addStripeCard(addStripeCardDto: AddStripCardDto, userId: string) {
    const user = await this.userService.getUserProfile(userId);
    const stripeCustomerId = await this.createStripeCustomerIfNotExists(user);
    const cardResponse = await this.createPaymentMethodForCustomerIfNotExists(
      stripeCustomerId,
      addStripeCardDto,
    );
    // Set first added card as default card
    if (!user.stripeCardId) {
      await this.userService.updateUser(userId, {
        stripeCardId: cardResponse.id,
      });
    }
    return {
      paymentMethodId: cardResponse.id,
      stripeCustomerId,
      card: cardResponse.card,
      metadata: cardResponse.metadata,
    };
  }

  async removeStripeCard(paymentMethodId: string, userId: string) {
    const user = await this.appRepository.user.getOne({
      where: {
        _id: userId,
      },
    });
    if (!user.billings?.stripe?.customerId) {
      throw new BadRequestException('User does not have stripe customer id');
    }

    const customer: any = await this.stripe.customers.retrieve(
      user.billings.stripe.customerId,
    );
    if (customer.invoice_settings.default_payment_method === paymentMethodId) {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: user.billings.stripe.customerId,
        type: 'card',
      });
      const paymentMethod = paymentMethods.data.find(
        (item) => item.id !== paymentMethodId,
      );
      if (paymentMethod) {
        await this.stripe.customers.update(user.billings.stripe.customerId, {
          invoice_settings: {
            default_payment_method: paymentMethod.id,
          },
        });
      }
    }
    await this.stripe.paymentMethods.detach(paymentMethodId);

    const userUpdated = await this.appRepository.user.findOneAndUpdate({
      where: {
        _id: userId,
        'billings.stripe.paymentMethods.id': paymentMethodId,
      },
      data: {
        $set: {
          'billings.stripe.paymentMethods.$.removedAt': new Date(),
        },
      },
      options: {
        new: true,
      },
    });

    return {
      paymentMethodId: paymentMethodId,
      stripeCustomerId: userUpdated.billings.stripe.customerId,
    };
  }

  async getSetupIntentToken() {
    return this.stripeService.getSetupIntentToken();
  }

  async attachPaymentMethod(paymentMethodId, user) {
    const customer = await this.appRepository.user.getOne({
      where: {
        _id: user._id,
      },
      select: 'billings.stripe',
    });

    const paymentMethod = await this.stripe.paymentMethods.attach(
      paymentMethodId,
      {
        customer: customer.billings.stripe.customerId,
      },
    );

    if (customer.billings?.stripe?.paymentMethods?.length) {
      await this.stripeService.updateStripeCustomer({
        stripeCustomerId: customer.billings?.stripe?.customerId,
        payload: {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        },
      });
    }
    const cardInfo = {
      id: paymentMethod.id,
      fingerprint: paymentMethod.card.fingerprint,
      billingDetails: paymentMethod.billing_details,
      createdAt: new Date(),
    };

    const updateData: any = {
      $push: {
        'billings.stripe.paymentMethods': cardInfo,
      },
    };
    await this.appRepository.user.updateOne({
      where: {
        _id: user._id,
      },
      data: {
        ...updateData,
      },
    });

    return paymentMethod;
  }

  async setDefaultCard(paymentMethodId: string, userId: string) {
    const user = await this.appRepository.user.getOne({
      where: {
        _id: userId,
      },
    });
    const updatedStripeCustomer: any =
      await this.stripeService.updateStripeCustomer({
        stripeCustomerId: user.billings?.stripe?.customerId,
        payload: {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        },
      });
    if (updatedStripeCustomer.httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(updatedStripeCustomer.message);
    }

    return {
      paymentMethodId: paymentMethodId,
      stripeCustomerId: user.billings?.stripe?.customerId,
    };
  }

  async createPaymentIntentCampaign({
    userId,
    paymentMethodId,
    amount,
    currency,
    contextId,
    customId,
  }: {
    userId: string;
    paymentMethodId: string;
    amount: number;
    currency: StripePaymentCurrencySupported;
    contextId: string;
    customId?: string;
  }) {
    const user = await this.userService.getUserProfile(userId);
    const amountInSmallestUnit = convertToSmallestUnit(amount, currency);
    if (amountInSmallestUnit === null) {
      throw new BadRequestException(`Currency is not supported: ${currency}`);
    }
    const currentPaymentMethod = await this.findStripeCardByPaymentId(
      paymentMethodId,
    );
    if (currentPaymentMethod.metadata.status !== StripeCardStatus.ACTIVE) {
      throw new BadRequestException({
        key: 'Please active your card before make payment',
      });
    }
    const { httpStatus, message, ...paymentIntent }: any =
      await this.stripeService.createPaymentIntent({
        options: {
          amount: amountInSmallestUnit,
          currency,
        },
        stripeCustomerId: user.stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        stripeCaptureMethod: StripeCaptureMethod.AUTOMATIC,
        confirm: true,
        description: `Payment for #${contextId}`,
        metadata: {
          custom_id: customId,
        },
      });

    if (httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(message);
    }
    return paymentIntent;
  }

  async requestActiveStripeCard(paymentMethodId: string, userId) {
    const user = await this.userService.getUserProfile(userId);
    const currentPaymentMethod = await this.findStripeCardByPaymentId(
      paymentMethodId,
    );
    await this.validateUserOwnership(currentPaymentMethod, user);
    await this.validateActiveCardStatus(currentPaymentMethod);
    const paymentHistory = await this.getPaymentHistoryActiveCard(
      paymentMethodId,
      userId,
      false,
    );
    // mark old payment is resolved and generate a new payment
    if (paymentHistory) {
      await this.updatePaymentHistoryActiveCard(paymentMethodId, userId);
    }
    const result = await this.createActiveCardPayment(
      currentPaymentMethod,
      user,
    );
    if (result.status === PaymentStatus.INCOMPLETE) {
      return result;
    }
    return {
      message:
        'Please check your app or internet banking to get the OTP. The OTP is valid for 1 hour.',
      success: true,
    };
  }

  async activeCard(paymentMethodId: string, userId, otp: string) {
    try {
      const user = await this.userService.getUserProfile(userId);
      const currentPaymentMethod = await this.findStripeCardByPaymentId(
        paymentMethodId,
      );
      await this.validateUserOwnership(currentPaymentMethod, user);
      await this.validateActiveCardStatus(currentPaymentMethod);
      const paymentHistory = await this.getPaymentHistoryActiveCard(
        paymentMethodId,
        userId,
      );
      if (paymentHistory.status !== PaymentStatus.SUCCEEDED) {
        throw new Error('Please complete your payment before continue');
      }
      const paymentIntent = await this.getPaymentIntent(
        paymentHistory.transactionId,
      );
      await this.validateOTPActiveCard(
        otp,
        paymentIntent,
        currentPaymentMethod,
      );
      await this.updatePaymentHistoryActiveCard(paymentMethodId, userId);
      return this.updatePaymentMethodActiveCard(
        paymentMethodId,
        currentPaymentMethod,
      );
    } catch (err) {
      throw new BadRequestException(err?.message || 'Something went wrong!');
    }
  }

  private async createActiveCardPayment(currentPaymentMethod, user) {
    const otp = generateActiveCardOTP();
    const paymentMethodId = currentPaymentMethod.paymentMethodId;
    const updatePaymentMethod: any =
      await this.stripeService.updatePaymentMethod({
        paymentMethodId,
        metadata: {
          ...currentPaymentMethod.metadata,
          otpExpiredAt: moment().unix() + OTP_STRIPE_CARD_EXPIRED,
        },
      });
    if (updatePaymentMethod.httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(updatePaymentMethod.message);
    }
    const amount = STRIPE_ACTIVE_CARD_FEE;
    const currency = StripePaymentCurrencySupported.USD;
    const { httpStatus, message, ...paymentIntent }: any =
      await this.stripeService.createPaymentIntent({
        options: {
          amount: convertToSmallestUnit(amount, currency),
          currency,
        },
        stripeCustomerId: user.stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        stripeCaptureMethod: StripeCaptureMethod.AUTOMATIC,
        confirm: true,
        description: `Active card`,
        statementDescriptor: `lider-${otp}`,
      });

    if (httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(message);
    }
    const createPaymentDto: CreatePaymentDto = {
      method: PaymentMethod.STRIPE,
      methodId: paymentMethodId,
      action: PaymentAction.ACTIVE_CARD,
      description: generateDescription({
        amount,
        currency,
        type: PaymentAction.ACTIVE_CARD,
        paymentType: PaymentMethod.STRIPE,
        transactionId: paymentIntent.id,
        paymentMethodId,
      }),
      amount,
      currency,
      transactionId: paymentIntent.id,
      paymentDate: moment().toDate(),
      isResolved: false,
      status: PaymentStatus.FAILED,
      paymentBy: parseObjectId(user.id),
    };

    let dataResponse: any = {};
    switch (paymentIntent.status) {
      case StripePaymentStatus.Succeeded:
        createPaymentDto.status = PaymentStatus.SUCCEEDED;
        dataResponse = {
          message: 'Payment Successful!',
          id: paymentIntent.id,
          status: PaymentStatus.SUCCEEDED,
        };
        break;
      case StripePaymentStatus.RequiresAction:
        createPaymentDto.status = PaymentStatus.INCOMPLETE;
        dataResponse = {
          message: '3D secure required',
          actionRequired: true,
          clientSecret: paymentIntent.client_secret,
          status: PaymentStatus.INCOMPLETE,
        };
        break;
      default:
        createPaymentDto.status = PaymentStatus.FAILED;
    }

    const paymentHistory = await this.appRepository.payment.createOne({
      data: {
        ...createPaymentDto,
      },
    });

    if (paymentHistory.status === PaymentStatus.FAILED) {
      throw new BadRequestException(
        'Payment verification failed. Please try again later',
      );
    }

    return dataResponse;
  }

  private async validateUserOwnership(currentPaymentMethod, user) {
    if (currentPaymentMethod.stripeCustomerId !== user.stripeCustomerId) {
      throw new BadRequestException('You are not owner of this card');
    }
  }
  private async validateActiveCardStatus(currentPaymentMethod) {
    if (currentPaymentMethod.metadata.status === StripeCardStatus.ACTIVE) {
      throw new BadRequestException('Your card has already approved');
    }
  }
  private async getPaymentHistoryActiveCard(
    paymentMethodId,
    userId,
    isThrowError = true,
  ) {
    const paymentHistory = await this.appRepository.payment.getOne({
      where: {
        methodId: paymentMethodId,
        paymentBy: parseObjectId(userId),
        action: PaymentAction.ACTIVE_CARD,
        isResolved: false,
      },
    });
    if (!paymentHistory && isThrowError) {
      throw new Error('payment of active card is not found');
    }
    return paymentHistory;
  }

  async getPaymentIntent(paymentIntentId: string) {
    const paymentIntent: any = await this.stripeService.getPaymentIntent({
      paymentIntentId,
    });
    if (paymentIntent.httpStatus !== HttpStatus.OK) {
      throw new Error(paymentIntent.message);
    }
    return paymentIntent;
  }

  private async validateOTPActiveCard(
    otp,
    paymentIntent,
    currentPaymentMethod,
  ) {
    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Please complete this payment before continue');
    }
    const otpActive = paymentIntent.statement_descriptor.split('-')[1];
    const { otpExpiredAt } = currentPaymentMethod.metadata;
    if (otp !== otpActive) {
      throw new Error('Your OTP is invalid');
    }
    if (moment().unix() > otpExpiredAt) {
      throw new Error('Your OTP has expired. Please try again later');
    }
  }
  private async updatePaymentHistoryActiveCard(paymentMethodId, userId) {
    return this.appRepository.payment.updateOne({
      data: {
        methodId: paymentMethodId,
        paymentBy: parseObjectId(userId),
        action: PaymentAction.ACTIVE_CARD,
        isResolved: false,
      },
      where: {
        status: PaymentStatus.SUCCEEDED,
        isResolved: true,
      },
    });
  }
  private async updatePaymentMethodActiveCard(
    paymentMethodId,
    currentPaymentMethod,
  ) {
    return this.stripeService.updatePaymentMethod({
      paymentMethodId,
      metadata: {
        ...currentPaymentMethod.metadata,
        status: StripeCardStatus.ACTIVE,
      },
    });
  }
  async checkPaymentIntent(paymentIntentId: string) {
    const paymentIntent: any = await this.stripeService.getPaymentIntent({
      paymentIntentId,
    });
    if (paymentIntent.httpStatus !== HttpStatus.OK) {
      throw new BadRequestException(paymentIntent.message);
    }

    // detail here: https://stripe.com/docs/payments/payment-intents/verifying-status
    if (paymentIntent?.status === StripePaymentStatus.Succeeded) {
      await this.appRepository.payment.updateOne({
        data: { transactionId: paymentIntentId },
        where: { status: PaymentStatus.SUCCEEDED },
      });
      return {
        message: 'Payment Successful!',
        id: paymentIntentId,
      };
    }

    if (paymentIntent.status === StripePaymentStatus.RequiresPaymentMethod) {
      await this.appRepository.payment.updateOne({
        data: { transactionId: paymentIntentId },
        where: { status: PaymentStatus.FAILED },
      });
    }

    throw new BadRequestException(
      'Payment verification failed. Please try again later',
    );
  }

  async createCustomer(userId: string, email: string) {
    let user = await this.appRepository.user.getOne({
      where: {
        _id: userId,
      },
      select: 'billing.stripe',
    });
    if (!user) {
      user = await this.appRepository.user.createOne({
        data: {
          email,
          _id: userId,
        },
      });
    }

    if (user?.billings?.stripe?.customerId) {
      return this.stripe.customers.retrieve(user.billings.stripe.customerId);
    }

    try {
      const customer: Stripe.Customer = await this.stripe.customers.create({
        email,
        description: 'Lider customer',
        metadata: { userId: String(userId) },
      });
      const newUserData: any = {
        'billings.stripe.customerId': customer.id,
        'billings.stripe.connectedAt': moment().toDate(),
      };
      await this.appRepository.user.updateOne({
        where: { _id: userId },
        data: {
          $set: newUserData,
        },
      });
      return customer;
    } catch (err) {
      throw new BadRequestException({ message: err.message });
    }
  }

  async requestPaymentIntent({ amount }: RequestPaymentDto, authUser) {
    try {
      const user = await this.appRepository.user.getOne({
        where: { _id: authUser._id },
      });
      const data: Partial<Payment> = {
        userId: user._id,
        amount,
        operator: '+',
        type: TRANSACTION_TYPE.USER_TOP_UP,
        paymentMethod: PaymentMethod.STRIPE,
        metadata: {
          service: 0.03,
          taxCharge: 0.03,
          amount,
          bankTransferAmount: 0.03,
        },
        status: PaymentStatus.PENDING,
      };
      const totalAmount = amount + 0.03 * amount + 0.03 * amount;
      const newTransaction = await this.appRepository.payment.createOne({
        data,
      });

      const paymentIntent = await this.createPaymentIntent({
        user,
        amount: totalAmount,
        transactionId: newTransaction._id,
      });

      const transactionStatus =
        paymentIntent.status === 'succeeded'
          ? PaymentStatus.SUCCEEDED
          : paymentIntent.status === 'canceled'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;

      await this.appRepository.payment.updateOne({
        where: { _id: newTransaction._id },
        data: {
          transactionId: paymentIntent.id,
          status: transactionStatus,
        },
      });

      if (transactionStatus === PaymentStatus.SUCCEEDED) {
        await this.appRepository.user.updateOne({
          where: { _id: user._id },
          data: {
            $inc: { deposit: amount },
          },
        });
      }

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        paymentMethodId: paymentIntent.payment_method,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async createPaymentIntent({ user, amount, transactionId, metadata = {} }) {
    const stripeCustomerId = user.billings?.stripe?.customerId;
    if (!stripeCustomerId) {
      throw new NotFoundException('error.stripe_customer_not_exist');
    }

    const customer = await this.stripe.customers.retrieve(stripeCustomerId);

    const defaultPaymentMethod = _.get(
      customer,
      'invoice_settings.default_payment_method',
    );

    if (!defaultPaymentMethod) {
      throw new NotFoundException(
        'error.stripe_missing_default_payment_method',
      );
    }

    try {
      const paymentIntentData: any = {
        amount: Math.round(amount * 100), //cent
        currency: 'usd',
        confirm: true,
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        description: `Lider customer topup money`,
        payment_method_options: {
          card: {
            request_three_d_secure: amount >= 250 ? 'any' : 'automatic',
          },
        },
        metadata: {
          ...metadata,
          userId: String(user._id),
          transactionId: String(transactionId),
        },
        payment_method: defaultPaymentMethod,
        receipt_email: user.email,
      };

      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentData,
      );
      return paymentIntent;
    } catch (error) {
      throw error;
    }
  }
}
