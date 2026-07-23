import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: any = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');

    if (host && user && pass) {
      try {
        const nodemailer = require('nodemailer');
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass,
          },
        });
        this.logger.log(`Nodemailer dynamic SMTP transporter initialized successfully for host ${host}:${port}`);
      } catch (err) {
        this.logger.warn('Failed to load nodemailer or initialize SMTP transporter. Defaulting to Console log fallback.', err);
      }
    } else {
      this.logger.log('SMTP credentials not configured in environment. Defaulting to Console log fallback.');
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const from = this.configService.get<string>('mail.from') || 'noreply@safetytracker.com';
    const to = options.to;
    const subject = options.subject;
    const text = options.text || '';
    const html = options.html || this.generateDefaultHtmlTemplate(subject, text);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`Email successfully sent to ${to} using SMTP.`);
        return;
      } catch (err) {
        this.logger.error(`Failed to send email to ${to} via SMTP:`, err);
      }
    }

    // Fallback/Dev Logging Transport
    this.logger.log(`
=========================================
[SMTP FALLBACK] EMAIL SENT
From: ${from}
To: ${to}
Subject: ${subject}
Body:
${text}
HTML:
${html.substring(0, 300)}... (truncated)
=========================================
    `);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;
    const text = `Please use the link below to reset your password. This link is valid for 30 minutes.\n\nURL: ${resetUrl}\nToken: ${token}`;
    const html = `
      <p>Hello,</p>
      <p>Please use the link below to reset your password. This link is valid for 30 minutes.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" class="btn" style="color: #ffffff;">Reset Password</a>
      </p>
      <p style="font-size: 14px; color: #64748b;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <code style="display: block; padding: 12px; background-color: #f1f5f9; border-radius: 6px; word-break: break-all;">${resetUrl}</code>
    `;
    await this.sendMail({
      to: email,
      subject: 'Reset Your Password',
      text,
      html: this.generateDefaultHtmlTemplate('Reset Your Password', html),
    });
  }

  async sendWelcomeInvitationEmail(
    email: string,
    userName?: string,
  ): Promise<void> {
    const name = userName || 'User';
    const subject = 'Welcome to Safety Tracker Pro!';
    const text = `Hi ${name},

Welcome to Safety Tracker Pro! We are excited to have you on board.

Your account is now active. If you have any questions or need assistance, please feel free to reach out to your administrator.

Thanks,
Safety Tracker Pro`;

    const html = `
      <p style="font-size: 16px; color: #1e293b;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">Welcome to <strong>Safety Tracker Pro</strong>! We are excited to have you on board.</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">Your account is now active. If you have any questions or need assistance, please feel free to reach out to your administrator.</p>
      <p style="margin-top: 32px; font-size: 15px; color: #334155;">Thanks,<br><strong style="color: #0f172a;">Safety Tracker Pro</strong></p>
    `;

    await this.sendMail({
      to: email,
      subject,
      text,
      html: this.generateDefaultHtmlTemplate(subject, html),
    });
  }

  async sendIssueToClientEmail(user: any, company: any, rawPassword?: string): Promise<void> {
    const userName = user.name || 'User';
    const usernameVal = user.email;
    const passVal = rawPassword || user.tempPassword || '[As set on account setup]';
    const androidUrl = 'https://play.google.com/store/apps/details?id=com.ess.emerald';
    const iosUrl = 'https://itunes.apple.com/ie/app/emerald-health-safety/id1439793775';

    const subject = `Your Account Credentials - Safety Tracker Pro`;
    const text = `Hi ${userName}

Your account has now been configured for the app and you can login with the following details:

Username: ${usernameVal}
Password: ${passVal}

You can download the Android app from:
${androidUrl}

And you can download the iPhone app from:
${iosUrl}

Thanks,

Safety Tracker Pro`;

    const html = `
      <p style="font-size: 16px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.5;">Your account has now been configured for the app and you can login with the following details:</p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-family: monospace; font-size: 14px;">
        <p style="margin: 0 0 10px 0;"><strong>Username:</strong> <span style="color: #1f6cb0; font-weight: 600;">${usernameVal}</span></p>
        <p style="margin: 0;"><strong>Password:</strong> <span style="color: #0f172a; font-weight: 600;">${passVal}</span></p>
      </div>

      <p style="margin-top: 24px; font-size: 15px; color: #334155;">You can download the <strong>Android app</strong> from:<br>
      <a href="${androidUrl}" style="color: #1f6cb0; font-weight: 500; word-break: break-all;">${androidUrl}</a></p>
      <p style="margin-top: 16px; font-size: 15px; color: #334155;">And you can download the <strong>iPhone app</strong> from:<br>
      <a href="${iosUrl}" style="color: #1f6cb0; font-weight: 500; word-break: break-all;">${iosUrl}</a></p>

      <p style="margin-top: 32px; font-size: 15px; color: #334155;">Thanks,<br><strong style="color: #0f172a;">Safety Tracker Pro</strong></p>
    `;

    await this.sendMail({
      to: user.email,
      subject,
      text,
      html: this.generateDefaultHtmlTemplate(subject, html),
    });
  }

  private generateDefaultHtmlTemplate(title: string, bodyHtmlContent: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 48px 0;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1f6cb0 0%, #1a365d 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: rgba(255,255,255,0.75);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 500;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      font-size: 16px;
      color: #334155;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #1f6cb0;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 16px;
      box-shadow: 0 2px 4px rgba(31, 108, 176, 0.2);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Safety Tracker Pro</h1>
      </div>
      <div class="content">
        ${bodyHtmlContent}
      </div>
      <div class="footer">
        <p>This is an automated notification from Safety Tracker Pro.</p>
        <p>&copy; ${new Date().getFullYear()} Scannel Safety Tracker. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

}

