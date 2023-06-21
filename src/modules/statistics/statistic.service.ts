import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import moment from 'moment';
import { AppRepository } from '../../database/app.repository';
import { createMongoIdByTimestamp } from '../../shared/utils/mongoose.util';
import { HelperService } from '../../helper/helper/helper.service';
import { PaymentStatus } from '../../constants/payment.constants';

@Injectable()
export class StatisticService {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly helperService: HelperService,
  ) {}

  async statisticAmountInAmountOut(user, query) {
    const where: any = {
      userId: new mongoose.Types.ObjectId(user._id),
    };
    if (!query.from) {
      query.from = moment.utc().subtract(7, 'days').format('YYYY-MM-DD');
    }
    if (!query.to) {
      query.to = moment.utc().format('YYYY-MM-DD');
    }
    let format: '%Y-%m-%d' | '%Y-%m' | '%Y' = '%Y-%m-%d';
    if (moment.utc(query.to).diff(moment.utc(query.from), 'days') > 365) {
      format = '%Y';
    }
    if (moment.utc(query.to).diff(moment.utc(query.from), 'days') > 45) {
      format = '%Y-%m';
    }

    if (query.from) {
      where._id = {
        $gte: createMongoIdByTimestamp(
          moment.utc(query.from).startOf('day').valueOf() / 1000,
          'from-time',
        ),
      };
    }
    if (query.to) {
      where._id = {
        ...where._id,
        $lte: createMongoIdByTimestamp(
          moment.utc(query.to).endOf('day').valueOf() / 1000,
          'to-time',
        ),
      };
    }

    let statistic = await this.appRepository.payment.aggregate([
      {
        $match: where,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: '$createdAt',
            },
          },
          date: {
            $first: '$createdAt',
          },
          'Amount In': {
            $sum: {
              $cond: [
                {
                  $eq: ['$operator', '+'],
                },
                '$amount',
                0,
              ],
            },
          },
          'Amount Out': {
            $sum: {
              $cond: [
                {
                  $eq: ['$operator', '-'],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          'Amount In': 1,
          'Amount Out': 1,
        },
      },
    ]);
    statistic = statistic.reduce((acc: any[], entry: any) => {
      acc.push({
        date: entry.date,
        type: 'Amount In',
        amount: entry['Amount In'],
      });
      acc.push({
        date: entry.date,
        type: 'Amount Out',
        amount: entry['Amount Out'],
      });
      return acc;
    }, []);

    if (format === '%Y-%m') {
      statistic = this.helperService.fillMissingMonths(
        statistic,
        query.from,
        query.to,
      );
    }
    if (format === '%Y-%m-%d') {
      statistic = this.helperService.fillMissingDays(
        statistic,
        query.from,
        query.to,
      );
    }
    return statistic;
  }

  async statisticTotal(user) {
    const result = await this.appRepository.payment.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(user._id),
          status: PaymentStatus.SUCCEEDED,
        },
      },
      {
        $group: {
          _id: null,
          'Amount In': {
            $sum: {
              $cond: [
                {
                  $eq: ['$operator', '+'],
                },
                '$amount',
                0,
              ],
            },
          },
          'Amount Out': {
            $sum: {
              $cond: [
                {
                  $eq: ['$operator', '-'],
                },
                '$amount',
                0,
              ],
            },
          },
        },
      },
    ]);

    return [
      {
        'Amount In': result[0] ? result[0]['Amount In'] : 0,
        'Amount Out': result[0] ? result[0]['Amount Out'] : 0,
      },
    ];
  }
}
