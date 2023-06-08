import { AuthGuard } from './../../../shared/services/auth-service/guard/auth.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestPaymentDto } from '../dtos/request-payment.dto';
import { PaypalPaymentsService } from '../services/paypal-payments.service';

@Controller('payments/paypal')
@ApiTags('Payment Paypal')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PaypalPaymentsController {
  constructor(private readonly paypalPaymentsService: PaypalPaymentsService) {}

  @Get('orders/:orderId')
  getOrder(@Param('orderId') orderId: string) {
    return this.paypalPaymentsService.getOrder(orderId);
  }

  @Get('payments/captures/:captureId')
  getCapturePaymentDetail(@Param('captureId') captureId: string) {
    return this.paypalPaymentsService.getCapturePaymentDetail(captureId);
  }

  @UseGuards(AuthGuard)
  @Post('request-payment')
  requestPayment(@Req() req, @Body() body: RequestPaymentDto) {
    return this.paypalPaymentsService.requestPayment(body, req.user);
  }

  @UseGuards(AuthGuard)
  @Post('fulfill')
  async capturePayment(@Req() req) {
    const { orderId } = req.body;
    await this.paypalPaymentsService.fulfillPaypalPayment(req, {
      user: req.user,
      orderId,
    });
  }
}
