import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  IStripeCreatePaymentIntents,
  IStripeCreateSetupIntents,
  IStripeCreateCustomer,
  IStripeCreatePaymentMethod,
  StripeReturnType,
  IStripeCustomErrorResponse,
} from './stripe.interface';

import { HttpStatus } from '@nestjs/common';
import {
  PaymentIntentMethod,
  StripeCaptureMethod,
  StripeCountry,
} from 'src/constants/payment.constants';

@Injectable()
export class StripeService {
  private readonly clients: { [key: string]: Stripe } = {};
  private readonly defaultClient = StripeCountry.SINGAPORE;

  constructor() {
    this.clients[StripeCountry.SINGAPORE] = new Stripe(
      process.env.STRIPE_SECRET_KEY,
      {
        apiVersion: process.env.STRIPE_VERSION as Stripe.LatestApiVersion,
      },
    );
  }
  private getStripeClient(client: string): Stripe {
    if (!this.clients[client]) {
      return this.clients[this.defaultClient];
    }
    return this.clients[client];
  }

  async createPaymentMethodForCustomer({
    client = this.defaultClient,
    card,
    customerId,
    metadata,
    billingDetails,
  }: {
    client?: string;
    card: IStripeCreatePaymentMethod;
    customerId: string;
    metadata?: Stripe.MetadataParam;
    billingDetails?: Stripe.PaymentMethodCreateParams.BillingDetails;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const paymentMethod: any = await this.createPaymentMethod({
        card,
        client,
        metadata,
        billingDetails,
      });
      if (paymentMethod.httpStatus !== HttpStatus.OK) {
        return paymentMethod;
      }
      const linkedPaymentMethod = await this.attachPaymentMethod({
        customerId,
        paymentMethodId: paymentMethod.id as string,
        client,
      });
      if (linkedPaymentMethod.httpStatus !== HttpStatus.OK) {
        return linkedPaymentMethod;
      }
      const result = {
        httpStatus: HttpStatus.OK,
        ...linkedPaymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async attachPaymentMethod({
    customerId,
    paymentMethodId,
    client = this.defaultClient,
  }: {
    customerId: string;
    paymentMethodId: string;
    client?: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const attachedPaymentMethod = await this.getStripeClient(
        client,
      ).paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...attachedPaymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async getStripeCustomer({
    client = this.defaultClient,
    stripeCustomerId,
  }: {
    client?: string;
    stripeCustomerId?: string;
  }): Promise<StripeReturnType<Stripe.Customer> | IStripeCustomErrorResponse> {
    try {
      const customers = await this.getStripeClient(client).customers.retrieve(
        stripeCustomerId,
      );

      const result = {
        httpStatus: HttpStatus.OK,
        ...customers,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async createStripeCustomer({
    options,
    client = this.defaultClient,
  }: {
    options: IStripeCreateCustomer;
    client?: string;
  }): Promise<StripeReturnType<Stripe.Customer> | IStripeCustomErrorResponse> {
    try {
      const createdCustomer = await this.getStripeClient(
        client,
      ).customers.create(options);
      const result = {
        httpStatus: HttpStatus.OK,
        ...createdCustomer,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async createPaymentMethod({
    card,
    client = this.defaultClient,
    metadata,
    billingDetails,
  }: {
    card: IStripeCreatePaymentMethod;
    client?: string;
    metadata?: Stripe.MetadataParam;
    billingDetails?: Stripe.PaymentMethodCreateParams.BillingDetails;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const clientStripe = this.getStripeClient(client);
      const createdPaymentMethod = await clientStripe.paymentMethods.create({
        type: 'card',
        card,
        metadata,
        billing_details: billingDetails,
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...createdPaymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async updatePaymentMethod({
    paymentMethodId,
    client = this.defaultClient,
    metadata,
    billingDetails,
  }: {
    paymentMethodId: string;
    client?: string;
    metadata?: Stripe.MetadataParam;
    billingDetails?: Stripe.PaymentMethodCreateParams.BillingDetails;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const createdPaymentMethod = await this.getStripeClient(
        client,
      ).paymentMethods.update(paymentMethodId, {
        billing_details: billingDetails,
        metadata,
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...createdPaymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async createSetupIntents({
    options,
    client = this.defaultClient,
  }: {
    options: IStripeCreateSetupIntents;
    client?: string;
  }): Promise<
    StripeReturnType<Stripe.SetupIntent> | IStripeCustomErrorResponse
  > {
    try {
      const createdSetupIntents = await this.getStripeClient(
        client,
      ).setupIntents.create({
        payment_method_types: ['card'],
        customer: options.customer,
        payment_method: options.paymentMethod,
        description: options.description,
        confirm: true,
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...createdSetupIntents,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  getSetupIntentToken() {
    return this.getStripeClient(this.defaultClient).setupIntents.create({
      payment_method_types: ['card'],
      description: 'Lider setup intent',
    });
  }
  async createPaymentIntent({
    options,
    stripeCustomerId,
    stripePaymentMethodId,
    stripeCaptureMethod = StripeCaptureMethod.MANUAL,
    confirm = false,
    description,
    client = this.defaultClient,
    statementDescriptor,
    metadata,
  }: {
    options: IStripeCreatePaymentIntents;
    stripeCustomerId: string;
    stripePaymentMethodId: string;
    stripeCaptureMethod: StripeCaptureMethod;
    confirm: boolean;
    description: string;
    statementDescriptor?: string;
    client?: string;
    metadata?: Stripe.MetadataParam;
  }): Promise<
    StripeReturnType<Stripe.PaymentIntent> | IStripeCustomErrorResponse
  > {
    try {
      // convert the amount to int to make sure the date sending to stripe is integer ( not a number )
      options.amount = parseInt(options.amount.toFixed(0));

      const data: Stripe.PaymentIntentCreateParams = {
        customer: stripeCustomerId,
        payment_method: stripePaymentMethodId,
        capture_method:
          stripeCaptureMethod as Stripe.PaymentIntentCreateParams.CaptureMethod,
        statement_descriptor: statementDescriptor,
        confirm,
        description,
        use_stripe_sdk: true,
        payment_method_options: {
          card: {
            request_three_d_secure: 'any',
          },
        },
        metadata,
        ...options,
      };

      const createdPaymentIntents = await this.getStripeClient(
        client,
      ).paymentIntents.create(data);
      const result = {
        httpStatus: HttpStatus.OK,
        ...createdPaymentIntents,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async cancelPaymentIntent({
    paymentIntentId,
    client = this.defaultClient,
  }: {
    paymentIntentId: string;
    client?: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentIntent> | IStripeCustomErrorResponse
  > {
    try {
      const canceledPaymentIntent = await this.getStripeClient(
        client,
      ).paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: 'requested_by_customer',
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...canceledPaymentIntent,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async updatePaymentIntent({
    paymentIntentId,
    client,
    method,
  }: {
    paymentIntentId: string;
    client?: string;
    method: PaymentIntentMethod;
  }): Promise<
    StripeReturnType<Stripe.PaymentIntent> | IStripeCustomErrorResponse
  > {
    try {
      let updatedPaymentIntent;
      switch (method) {
        case PaymentIntentMethod.CAPTURE:
          updatedPaymentIntent = await this.getStripeClient(
            client,
          ).paymentIntents.capture(paymentIntentId);
          break;
        case PaymentIntentMethod.CONFIRM:
          updatedPaymentIntent = await this.getStripeClient(
            client,
          ).paymentIntents.confirm(paymentIntentId);
          break;
        default:
          break;
      }
      const result = {
        httpStatus: HttpStatus.OK,
        ...updatedPaymentIntent,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async refundPaymentIntent({
    paymentIntentId,
    amount = null,
    client,
  }: {
    paymentIntentId: string;
    amount: number; // fully refund if amount = null
    client?: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentIntent> | IStripeCustomErrorResponse
  > {
    try {
      // convert the amount to int to make sure the date sending to stripe is integer ( not a number )
      amount = amount ? parseInt(amount.toFixed(0)) : null; //add condition if amount is null no need to parsing
      const refundedPaymentIntent = await this.getStripeClient(
        client,
      ).refunds.create({
        payment_intent: paymentIntentId,
        amount: amount || undefined,
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...refundedPaymentIntent,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async getPaymentIntent({
    paymentIntentId,
    client,
  }: {
    paymentIntentId: string;
    client?: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentIntent> | IStripeCustomErrorResponse
  > {
    try {
      const paymentIntent = await this.getStripeClient(
        client,
      ).paymentIntents.retrieve(paymentIntentId);
      const result = {
        httpStatus: HttpStatus.OK,
        ...paymentIntent,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async getListCustomerCard({
    client,
    stripeCustomerId,
  }: {
    client?: string;
    stripeCustomerId: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const customerDetail = await this.getStripeClient(
        client,
      ).paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...customerDetail,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async updateStripeCustomer({
    client = this.defaultClient,
    stripeCustomerId,
    payload,
  }: {
    client?: string;
    stripeCustomerId: string;
    payload: Stripe.CustomerUpdateParams;
  }): Promise<
    | StripeReturnType<Stripe.Customer | Stripe.DeletedCustomer>
    | IStripeCustomErrorResponse
  > {
    try {
      const customerDetail = await this.getStripeClient(
        client,
      ).customers.update(stripeCustomerId, payload);
      const result = {
        httpStatus: HttpStatus.OK,
        ...customerDetail,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async detachPaymentMethod({
    client = this.defaultClient,
    paymentMethodId,
  }: {
    client?: string;
    paymentMethodId: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const detachedPaymentMethod = await this.getStripeClient(
        client,
      ).paymentMethods.detach(paymentMethodId, {
        expand: ['customer'],
      });
      const result = {
        httpStatus: HttpStatus.OK,
        ...detachedPaymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  async getPaymentMethod({
    client,
    paymentMethodId,
  }: {
    client?: string;
    paymentMethodId: string;
  }): Promise<
    StripeReturnType<Stripe.PaymentMethod> | IStripeCustomErrorResponse
  > {
    try {
      const paymentMethod = await this.getStripeClient(
        client,
      ).paymentMethods.retrieve(paymentMethodId);
      const result = {
        httpStatus: HttpStatus.OK,
        ...paymentMethod,
      };
      return result;
    } catch (e) {
      return this.formatStripeError(e);
    }
  }

  formatStripeError(error: Stripe.StripeRawError): IStripeCustomErrorResponse {
    return {
      requestId: error.requestId,
      httpStatus: error.statusCode,
      code: error.code,
      type: error.type,
      rawType: error.type,
      message: error.message ?? error.message ?? 'An error occurred',
    };
  }
}
