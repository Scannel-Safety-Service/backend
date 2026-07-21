import { registerAs } from '@nestjs/config';

export default registerAs('onesignal', () => ({
  appId: process.env.ONESIGNAL_APP_ID!,
  restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
}));
