export interface IServicesConfiguration {
  auth: {
    url: string;
    gqlUrl: string;
  };
}

export const servicesConfigurationFn = (): IServicesConfiguration => ({
  auth: {
    gqlUrl:
      process.env.AUTH_SERVICE_GQL_URL || 'http://localhost/api/auth/graphql',
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:4001/api/auth',
  },
});
