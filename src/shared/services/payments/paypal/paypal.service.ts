import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { PaypalMode } from 'src/constants/payment.constants';
import { AsyncService } from '../../../../helper/async/async.service';
import { HttpRequestService } from '../../../../helper/http-request/http-request.service';
import { RedisHelperService } from '../../../../helper/redis-helper/redis-helper.service';
import { RedisLockService } from '../../../../helper/redis-helper/redis-lock.service';

@Injectable()
export class PaypalService extends HttpRequestService {
  private clientId: string;
  private appSecret: string;
  private apiUrl: string;
  private URL_ENDPOINT: any;

  constructor(
    private readonly redisHelper: RedisHelperService,
    protected readonly httpService: HttpService,
    protected readonly asyncService: AsyncService,
    protected readonly redisLockService: RedisLockService,
  ) {
    super(asyncService, httpService, redisLockService);

    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.appSecret = process.env.PAYPAL_APP_SECRET;
    this.apiUrl = `https://api.${
      process.env.PAYPAL_MODE === PaypalMode.SANDBOX ? 'sandbox.' : ''
    }paypal.com`;

    this.URL_ENDPOINT = {
      VERIFY_WEBHOOK_SIGNATURE: `${this.apiUrl}/v1/notifications/verify-webhook-signature`,
      GET_ACCESS_TOKEN: `${this.apiUrl}/v1/oauth2/token`,
      GENERATE_CLIENT_TOKEN: `${this.apiUrl}/v1/identity/generate-token`,
      CREATE_ORDER: `${this.apiUrl}/v2/checkout/orders`,
      GET_ORDER_DETAIL: ({ orderId }) =>
        `${this.apiUrl}/v2/checkout/orders/${orderId}`,
      CAPTURE_ORDER: ({ orderId }) =>
        `${this.apiUrl}/v2/checkout/orders/${orderId}/capture`,
    };
  }

  // async generateAccessToken() {
  //   const auth = Buffer.from(`${this.clientId}:${this.appSecret}`).toString(
  //     'base64',
  //   );
  //   try {
  //     const response = await axios.post(
  //       `${this.apiUrl}/v1/oauth2/token`,
  //       'grant_type=client_credentials',
  //       {
  //         headers: {
  //           Authorization: `Basic ${auth}`,
  //         },
  //       },
  //     );
  //     return response.data.access_token;
  //   } catch (err) {
  //     throw new Error(err.response.data);
  //   }
  // }

  async generateAccessToken() {
    const key = `paypal_access_token`;
    const result = await this.redisHelper.getKey(key);
    if (result?.accessToken) {
      return result?.accessToken;
    }
    const auth = Buffer.from(`${this.clientId}:${this.appSecret}`).toString(
      'base64',
    );

    const data = await this.request({
      url: `${this.apiUrl}/v1/oauth2/token`,
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      data: 'grant_type=client_credentials',
    });

    await this.redisHelper.setKey(
      key,
      { accessToken: data.access_token },
      data.expires_in - 1000,
    );

    return data.access_token;
  }

  async createOrder({ amount, transactionId, user }) {
    const accessToken = await this.generateAccessToken();

    return this.request({
      url: this.URL_ENDPOINT.CREATE_ORDER,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: amount,
            },
            description: `Lider payment for user ${user._id}`,
            custom_id: `${transactionId}`,
          },
        ],
      }),
    });
  }

  async getOrderDetail({ orderId }) {
    const accessToken = await this.generateAccessToken();
    const data = await this.request({
      url: this.URL_ENDPOINT.GET_ORDER_DETAIL({ orderId }),
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return data;
  }

  async capturePayment({ orderId }): Promise<any> {
    const accessToken = await this.generateAccessToken();
    return this.request({
      url: this.URL_ENDPOINT.CAPTURE_ORDER({ orderId }),
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async makeApiCall({
    url,
    data,
    accessToken,
    method = 'POST',
  }: {
    url: any;
    accessToken: string;
    data?: any;
    method?: string;
  }) {
    const options: any = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };
    if (method === 'POST' || method === 'PUT') {
      options.data = data;
    }
    try {
      const response = await axios({
        method,
        url,
        ...options,
      });
      return response.data;
    } catch (err) {
      throw new BadRequestException(
        err.response?.data?.message || 'Something went wrong!',
      );
    }
  }

  // async createOrder(orderData: any) {
  //   const accessToken = await this.generateAccessToken();
  //   const url = `${this.apiUrl}/v2/checkout/orders`;
  //   return this.makeApiCall({ url, data: orderData, accessToken });
  // }

  async getOrderData(orderId) {
    const accessToken = await this.generateAccessToken();
    const url = `${this.apiUrl}/v2/checkout/orders/${orderId}`;
    return this.makeApiCall({ url, accessToken, method: 'GET' });
  }

  async capturePaymentOrder(orderId) {
    const accessToken = await this.generateAccessToken();
    const url = `${this.apiUrl}/v2/checkout/orders/${orderId}/capture`;
    return this.makeApiCall({ url, data: {}, accessToken });
  }

  async getCapturePaymentDetail(captureId) {
    const accessToken = await this.generateAccessToken();
    const url = `${this.apiUrl}/v2/payments/captures/${captureId}`;
    return this.makeApiCall({ url, data: {}, accessToken, method: 'GET' });
  }
}
