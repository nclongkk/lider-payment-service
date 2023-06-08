import { Body, Controller, Post } from '@nestjs/common';
import { ChargeServiceFeeDto } from '../dtos/charge-service-fee.dto';
import { PaymentsService } from '../services/payments.service';

@Controller('payments/internal')
export class PaymentsInternalController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('charge-service-fee')
  chargeServiceFee(@Body() chargeServiceFee: ChargeServiceFeeDto) {
    return this.paymentsService.chargeServiceFee(chargeServiceFee);
  }
}
