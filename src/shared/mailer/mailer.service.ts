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
    const resetUrl = `http://localhost:3000/api/v1/auth/reset-password?token=${token}`;
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
    token: string,
  ): Promise<void> {
    const inviteUrl = `http://localhost:3000/api/v1/auth/accept-invitation?token=${token}`;
    const text = `An account has been created for you. Click the link below to set your password and access your account.\n\nURL: ${inviteUrl}\nToken: ${token}`;
    const html = `
      <p>Hello,</p>
      <p>An account has been created for you. Click the link below to set your password and access your account.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" class="btn" style="color: #ffffff;">Accept Invitation</a>
      </p>
      <p style="font-size: 14px; color: #64748b;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <code style="display: block; padding: 12px; background-color: #f1f5f9; border-radius: 6px; word-break: break-all;">${inviteUrl}</code>
    `;
    await this.sendMail({
      to: email,
      subject: 'Welcome to Scannel Safety Service!',
      text,
      html: this.generateDefaultHtmlTemplate('Welcome Invitation', html),
    });
  }

  async sendIssueToClientEmail(user: any, company: any): Promise<void> {
    const loginUrl = 'http://localhost:3000/login';
    const companyName = company?.name || 'Safety Tracker Pro';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Client';
    
    const subject = `Your Access Credentials for ${companyName} - Issued`;
    const text = `Hello ${fullName},\n\nYour access credentials for ${companyName} have been issued.\n\nUser ID: ${user.userCode || user.id}\nEmail: ${user.email}\nRole: ${user.role}\n\nPlease access your portal at: ${loginUrl}`;
    
    const html = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background-color: rgba(31, 108, 176, 0.1); line-height: 48px; text-align: center; margin-bottom: 12px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1f6cb0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; vertical-align: middle;">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 style="margin: 0; color: #1e293b; font-size: 22px; font-weight: 700;">Account Credentials Issued</h2>
        <p style="color: #64748b; margin: 4px 0 0 0;">Safety Compliance & Tracking Suite</p>
      </div>

      <p>Hello <strong>${fullName}</strong>,</p>
      <p>Your administrator has issued the access credentials for your account associated with <strong>${companyName}</strong>. Below are the profile details configured for your login:</p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 500; width: 120px;">Company</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 500; border-top: 1px solid #f1f5f9;">User Code / ID</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-size: 13px; font-weight: 600; border-top: 1px solid #f1f5f9;">${user.userCode || user.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 500; border-top: 1px solid #f1f5f9;">Email Address</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; border-top: 1px solid #f1f5f9;">${user.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 500; border-top: 1px solid #f1f5f9;">System Role</td>
            <td style="padding: 8px 0; color: #0f172a; border-top: 1px solid #f1f5f9;">
              <span style="background-color: rgba(31, 108, 176, 0.1); color: #1f6cb0; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                ${user.role}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" class="btn" style="color: #ffffff; padding: 12px 32px; font-size: 15px; border-radius: 8px; display: inline-block;">Access Safety Portal</a>
      </div>

      <div style="border-left: 3px solid #e2e8f0; padding-left: 16px; margin: 24px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
        <strong style="color: #475569; display: block; margin-bottom: 4px;">Security Notice:</strong>
        Please keep your login credentials private. If you have not set up your password yet, please use the welcome/activation link previously sent to your email or contact your administrator to trigger a password reset.
      </div>
    `;

    await this.sendMail({
      to: user.email,
      subject,
      text,
      html: this.generateDefaultHtmlTemplate(subject, html),
    });
  }

  private generateDefaultHtmlTemplate(title: string, bodyHtmlContent: string): string {
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
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
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
        <h1>Global Safety Tracker</h1>
      </div>
      <div class="content">
        ${bodyHtmlContent}
      </div>
      <div class="footer">
        <p>This is an automated security notification from Scannel Safety Tracker.</p>
        <p>&copy; ${new Date().getFullYear()} Scannel. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}
