import { UserModule } from './modules/user/user.module';
import { PaymentModule } from './modules/payments/payment.module';

import { AppRepositoryModule } from './database/app-repository.module';
import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/config.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SwaggerConfig } from './config/swagger/swagger.config';
import { LoggerConfigModule } from './config/logger/logger.module';
import { I18nConfigModule } from './config/i18n/i18n.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseConfigService } from './config/database/mongoose.config';
import { RedisHelperModule } from './helper/redis-helper/redis-helper.module';
import { AsyncModule } from './helper/async/async.module';
import { HttpModule } from '@nestjs/axios';
import { StripeModule } from './shared/stripe-module/stripe.module';
import { AuthModule } from './shared/services/auth-service/auth.module';
import { StatisticModule } from './modules/statistics/statistic.module';
import { HelperModule } from './helper/helper/helper.module';

@Module({
  imports: [
    ConfigurationModule,
    LoggerConfigModule,
    I18nConfigModule,
    MongooseModule.forRootAsync({
      useClass: MongooseConfigService,
    }),
    HelperModule,
    AppRepositoryModule,
    StripeModule,
    UserModule,
    PaymentModule,
    AsyncModule,
    RedisHelperModule,
    AuthModule,
    HttpModule,
    StatisticModule,
  ],
  controllers: [AppController],
  providers: [AppService, SwaggerConfig],
})
export class AppModule {}
