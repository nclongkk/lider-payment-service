import { Global, Module } from '@nestjs/common';
import { stripeProviders } from './stripe.providers';

@Global()
@Module({
  providers: [...stripeProviders],
  exports: [...stripeProviders],
})
export class StripeModule {}
