import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3000/api/v1/auth/reset-password?token=${token}`;
    this.logger.log(`
=========================================
EMAIL SENT: Password Reset
To: ${email}
Subject: Reset Your Password
Body:
  Please use the link below to reset your password. This link is valid for 30 minutes.
  
  URL: ${resetUrl}
  Token: ${token}
=========================================
    `);
  }

  async sendWelcomeInvitationEmail(email: string, token: string): Promise<void> {
    const inviteUrl = `http://localhost:3000/api/v1/auth/accept-invitation?token=${token}`;
    this.logger.log(`
=========================================
EMAIL SENT: Welcome Invitation
To: ${email}
Subject: Welcome to Scannel Safety Service!
Body:
  An account has been created for you. Click the link below to set your password and access your account.
  
  URL: ${inviteUrl}
  Token: ${token}
=========================================
    `);
  }
}
