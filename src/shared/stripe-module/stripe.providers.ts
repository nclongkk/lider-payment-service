import { Provider } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_KEY } from './constants/stripe.constants';

const apiVersion = '2022-11-15';
export const stripeProviders: Provider[] = [
  {
    useFactory: (): Stripe => {
      return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion,
      });
    },
    provide: STRIPE_KEY,
  },
];
