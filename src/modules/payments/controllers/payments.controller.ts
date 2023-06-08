import * as nc from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/decorators';
import { Pagination } from 'src/shared/decorators/pagination.decorator';
import { Sort } from 'src/shared/decorators/sort.decorator';
import { PaginationParam } from 'src/shared/interfaces';
import { ISortOrder } from 'src/shared/interfaces/sort.interface';
import { AuthGuard } from '../../../shared/services/auth-service/guard/auth.guard';
import { PaymentsService } from '../services/payments.service';

@nc.Controller('payments')
@ApiTags('Payment')
@ApiBearerAuth()
@nc.UseGuards(AuthGuard)
export class PaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @nc.Get('history')
  @ApiQuery({
    name: 'searchKey',
    required: false,
    type: String,
  })
  findPaymentsByCurrentUser(
    @CurrentUser() user,
    @Sort() sort: ISortOrder,
    @nc.Query() query?: any,
    @Pagination() paginationParam?: PaginationParam,
  ) {
    query = {
      userId: user._id,
      ...query,
    };
    return this.paymentsService.findPaymentsByCurrentUser(
      paginationParam,
      sort,
      query,
    );
  }

  @nc.UseGuards(AuthGuard)
  @nc.Get('/user')
  getPaymentUser(@nc.Req() req) {
    return this.paymentsService.getPaymentUser(req.user._id);
  }
}
