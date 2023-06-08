import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GqlAuthGuard } from '../../shared/services/auth-service/guard/gql-auth.guard';
import { StatisticService } from './statistic.service';

@Controller('payments/statistics')
@ApiTags('statistics')
@ApiBearerAuth()
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @ApiQuery({
    name: 'from',
    required: false,
    type: Date,
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: Date,
  })
  @Get('amount-in-amount-out')
  @GqlAuthGuard()
  async statisticAmountInAmountOut(@Req() req, @Query() query: any) {
    const user = req.user;
    return this.statisticService.statisticAmountInAmountOut(user, query);
  }

  @Get('total')
  @GqlAuthGuard()
  async statisticTotal(@Req() req) {
    return this.statisticService.statisticTotal(req.user);
  }
}
