import { loggerConfigurationFn } from './logger/configuration';
import { authConfigurationFn } from './auth/configuration';
import { appConfigurationFn } from './app/configuration';
import { swaggerConfigurationFn } from './swagger/configuration';
import { databaseConfigurationFn } from './database/configuration';
import { servicesConfigurationFn } from './services/configuration';

export const configuration = () => ({
  app: appConfigurationFn(),
  auth: authConfigurationFn(),
  swagger: swaggerConfigurationFn(),
  logger: loggerConfigurationFn(),
  database: databaseConfigurationFn(),
  service: servicesConfigurationFn(),
});
