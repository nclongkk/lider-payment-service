import { Injectable } from '@nestjs/common';

import * as repo from './repositories';

@Injectable()
export class AppRepository {
  constructor(
    public readonly payment: repo.TransactionRepository,
    public readonly user: repo.UserRepository,
  ) {}
}
