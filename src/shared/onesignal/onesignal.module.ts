import { Global, Module } from '@nestjs/common';
import { OneSignalService } from './onesignal.service';

/**
 * OneSignalModule
 *
 * Global module — imported once in AppModule, available everywhere.
 * Exports OneSignalService for injection into any module without
 * needing to re-import.
 */
@Global()
@Module({
  providers: [OneSignalService],
  exports: [OneSignalService],
})
export class OneSignalModule {}
