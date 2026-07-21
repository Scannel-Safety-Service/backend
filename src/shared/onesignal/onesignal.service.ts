import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OneSignalNotificationPayload {
  /** OneSignal subscription IDs (formerly player IDs) to target */
  subscriptionIds: string[];
  /** Short notification title */
  title: string;
  /** Full notification body text */
  body: string;
  /** Optional arbitrary key-value data attached to the notification */
  data?: Record<string, string>;
}

export interface OneSignalResult {
  /** Whether OneSignal accepted the notification */
  success: boolean;
  /** OneSignal notification ID on success */
  notificationId?: string;
  /** Error message on failure */
  error?: string;
}

/**
 * OneSignalService
 *
 * A thin, typed wrapper around the OneSignal REST API v11.
 * All credentials are read from environment variables — never hard-coded.
 *
 * REST API docs: https://documentation.onesignal.com/reference/create-notification
 */
@Injectable()
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly apiUrl = 'https://api.onesignal.com/notifications';
  private readonly appId: string;
  private readonly restApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('ONESIGNAL_APP_ID')!;
    this.restApiKey = this.configService.get<string>('ONESIGNAL_REST_API_KEY')!;
  }

  /**
   * Sends a push notification to a specific set of OneSignal subscription IDs.
   *
   * This method fans out to all provided subscriptionIds in a single API call.
   * OneSignal handles per-device delivery internally.
   *
   * @param payload - Notification content and target subscription IDs
   * @returns OneSignalResult indicating success/failure and the notification ID
   */
  async sendToSubscriptionIds(
    payload: OneSignalNotificationPayload,
  ): Promise<OneSignalResult> {
    const { subscriptionIds, title, body, data } = payload;

    if (!subscriptionIds || subscriptionIds.length === 0) {
      return {
        success: false,
        error: 'No subscription IDs provided — no devices to notify',
      };
    }

    const requestBody = {
      app_id: this.appId,
      // Target specific subscription IDs (individual/subscription targeting)
      include_subscription_ids: subscriptionIds,
      headings: { en: title },
      contents: { en: body },
      // Additional data passed to the mobile app's notification handler
      ...(data ? { data } : {}),
      // Delivery settings — respect Do Not Disturb, allow lazy delivery
      delayed_option: 'immediate',
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Key ${this.restApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json() as Record<string, any>;

      if (!response.ok) {
        const errorMsg =
          responseBody?.errors?.join(', ') ??
          responseBody?.error ??
          `HTTP ${response.status}`;
        this.logger.warn(
          `OneSignal API error [${response.status}]: ${errorMsg}`,
        );
        return { success: false, error: errorMsg };
      }

      // OneSignal may partially succeed — log recipients with errors
      if (responseBody.errors && responseBody.errors.length > 0) {
        this.logger.warn(
          `OneSignal partial errors: ${JSON.stringify(responseBody.errors)}`,
        );
      }

      this.logger.log(
        `OneSignal notification sent [id=${responseBody.id}] to ${subscriptionIds.length} device(s)`,
      );

      return { success: true, notificationId: responseBody.id as string };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown network error';
      this.logger.error(`OneSignal network failure: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}
