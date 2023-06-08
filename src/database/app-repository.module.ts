import { MongooseModule } from '@nestjs/mongoose';
import { Global, Module } from '@nestjs/common';

import * as schema from './schemas';
import { AppRepository } from './app.repository';
import * as repo from './repositories';
import { Payment } from './schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Payment.name,
        schema: schema.TransactionSchema,
        collection: 'transactions',
      },
      {
        name: 'User',
        schema: schema.UserSchema,
        collection: 'users',
      },
    ]),
  ],
  exports: [AppRepository],
  providers: [...Object.values(repo), AppRepository],
})
export class AppRepositoryModule {}
