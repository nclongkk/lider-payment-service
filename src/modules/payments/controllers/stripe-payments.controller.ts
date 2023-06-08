import * as nc from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StripePaymentsService } from '../services/stripe-payments.service';
import { CurrentUser } from 'src/shared/decorators';
import { AuthGuard } from '../../../shared/services/auth-service/guard/auth.guard';
import { Req, UseGuards } from '@nestjs/common';
import { AttachPaymentMethodDto } from '../dtos/attach-payment-method.dto';
import { RequestPaymentDto } from '../dtos/request-payment.dto';

@nc.Controller('payments/stripe')
@ApiTags('Payment Stripe')
@ApiBearerAuth()
export class StripePaymentsController {
  constructor(private readonly paymentsStripeService: StripePaymentsService) {}

  @nc.Post('/create-customer')
  createCustomer(@nc.Body() body: any) {
    return this.paymentsStripeService.createCustomer(body._id, body.email);
  }

  @nc.UseGuards(AuthGuard)
  @nc.Get()
  getListStripeCardByUser(@Req() req) {
    return this.paymentsStripeService.findStripeCardsByUser(req.user._id);
  }

  @nc.UseGuards(AuthGuard)
  @nc.Get(':paymentMethodId')
  getStripeCardByPaymentId(
    @nc.Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.paymentsStripeService.findStripeCardByPaymentId(
      paymentMethodId,
    );
  }

  @nc.UseGuards(AuthGuard)
  @nc.Post('/setup-intent')
  setupIntent(@Req() req) {
    return this.paymentsStripeService.getSetupIntentToken();
  }

  @nc.UseGuards(AuthGuard)
  @nc.Post('/attach-payment-method')
  attachPaymentMethod(@nc.Req() req, @nc.Body() body: AttachPaymentMethodDto) {
    return this.paymentsStripeService.attachPaymentMethod(
      body.paymentMethodId,
      req.user,
    );
  }

  @nc.UseGuards(AuthGuard)
  @nc.Post()
  addStripeCard(@nc.Body() addStripeCardDto: any, @CurrentUser() user) {
    return this.paymentsStripeService.addStripeCard(addStripeCardDto, user.id);
  }

  @nc.UseGuards(AuthGuard)
  @nc.Patch('/default-card/:paymentMethodId')
  setDefaultCard(
    @nc.Param('paymentMethodId') paymentMethodId: string,
    @Req() req,
  ) {
    return this.paymentsStripeService.setDefaultCard(
      paymentMethodId,
      req.user._id,
    );
  }

  @nc.UseGuards(AuthGuard)
  @nc.Delete(':paymentMethodId')
  removeStripeCard(
    @nc.Param('paymentMethodId') paymentMethodId: string,
    @Req() req,
  ) {
    return this.paymentsStripeService.removeStripeCard(
      paymentMethodId,
      req.user._id,
    );
  }

  @nc.UseGuards(AuthGuard)
  @nc.Patch('/payment-intent/:paymentIntentId/check')
  checkPaymentIntent(@nc.Param('paymentIntentId') paymentIntentId: string) {
    return this.paymentsStripeService.checkPaymentIntent(paymentIntentId);
  }

  @nc.UseGuards(AuthGuard)
  @nc.Post('/payment-intent')
  createPaymentIntent(@nc.Body() body: RequestPaymentDto, @Req() req) {
    return this.paymentsStripeService.requestPaymentIntent(body, req.user);
  }
}
