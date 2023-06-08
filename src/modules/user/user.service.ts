import { Injectable } from '@nestjs/common';

import { AppRepository } from '../../database/app.repository';
import * as mockUserAPI from 'src/shared/mock-api/user.api';

@Injectable()
export class UserService {
  constructor(private readonly appRepository: AppRepository) {}

  // mock API update later
  async getUserProfile(userId) {
    return mockUserAPI.getUserById(userId);
  }

  async updateUser(userId, dataUpdate) {
    return {
      id: userId,
      ...dataUpdate,
    };
  }
}
