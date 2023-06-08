import { Global, Module } from '@nestjs/common';

import { PaymentController } from './controllers/payments.controller';
import { ConfigurationModule } from '../../config/config.module';
import { StripePaymentsController } from './controllers/stripe-payments.controller';
import { StripePaymentsService } from './services/stripe-payments.service';
import { UserService } from '../user/user.service';
import { PaypalService, StripeService } from 'src/shared/services/payments';
import { PaypalPaymentsService } from './services/paypal-payments.service';
import { PaymentsService } from './services/payments.service';
import { PaypalPaymentsController } from './controllers/paypal-payments.controller';
import { HttpModule } from '@nestjs/axios';
import { PaymentsInternalController } from './controllers/payments-internal.controller';

@Global()
@Module({
  imports: [ConfigurationModule, HttpModule],
  providers: [
    StripeService,
    StripePaymentsService,
    PaypalService,
    PaypalPaymentsService,
    PaymentsService,
    UserService,
  ],
  controllers: [
    PaymentsInternalController,
    PaymentController,
    StripePaymentsController,
    PaypalPaymentsController,
  ],
})
export class PaymentModule {}
