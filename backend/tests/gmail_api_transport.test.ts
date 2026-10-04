import { google } from 'googleapis';
import {
  buildRfc2822Message,
  encodeBase64Url,
  resolveTransportConfig,
  sendViaGmailApi,
} from '../src/services/emailService';

describe('Gmail REST API (OAuth2) Transport Unit Tests', () => {
  describe('encodeBase64Url', () => {
    it('correctly replaces + with -, / with _, and strips trailing = padding', () => {
      // Input chosen specifically to generate +, /, and = padding in standard base64
      // Standard base64 of 'subjects?abcd\xff\xfe' is 'c3ViamVjdHM/YWJjZP/+':
      // with + and /: 'test?>>>????' -> base64 'dGVzdD8+Pj4/Pz8=' -> base64url 'dGVzdD8-Pj4_Pz8'
      const rawText = 'test?>>>????\xff\xee';
      const encoded = encodeBase64Url(rawText);

      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('handles buffer input properly', () => {
      const buf = Buffer.from('hello world', 'utf-8');
      const encoded = encodeBase64Url(buf);
      expect(encoded).toBe('aGVsbG8gd29ybGQ');
    });
  });

  describe('buildRfc2822Message', () => {
    it('builds a valid multipart/alternative MIME message when both text and html are provided', () => {
      const msg = buildRfc2822Message({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject 123',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      });

      expect(msg).toContain('From: sender@example.com');
      expect(msg).toContain('To: recipient@example.com');
      expect(msg).toContain('Subject: =?UTF-8?B?');
      expect(msg).toContain('MIME-Version: 1.0');
      expect(msg).toContain('Content-Type: multipart/alternative;');
      expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(msg).toContain('Plain text version');
      expect(msg).toContain('Content-Type: text/html; charset="UTF-8"');
      expect(msg).toContain('<p>HTML version</p>');
    });

    it('builds a text/plain MIME message when only text is provided', () => {
      const msg = buildRfc2822Message({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Plain Text Only',
        text: 'Hello plain world',
      });

      expect(msg).toContain('From: sender@example.com');
      expect(msg).toContain('To: recipient@example.com');
      expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(msg).toContain('Hello plain world');
      expect(msg).not.toContain('multipart/alternative');
    });

    it('builds a text/html MIME message when only html is provided', () => {
      const msg = buildRfc2822Message({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'HTML Only',
        html: '<h1>Hello HTML</h1>',
      });

      expect(msg).toContain('From: sender@example.com');
      expect(msg).toContain('To: recipient@example.com');
      expect(msg).toContain('Content-Type: text/html; charset="UTF-8"');
      expect(msg).toContain('<h1>Hello HTML</h1>');
      expect(msg).not.toContain('multipart/alternative');
    });
  });

  describe('resolveTransportConfig', () => {
    it('prioritizes gmail_oauth when GMAIL_OAUTH credentials are provided', () => {
      const resolved = resolveTransportConfig({
        NODE_ENV: 'production',
        GMAIL_OAUTH_CLIENT_ID: 'mock-client-id.apps.googleusercontent.com',
        GMAIL_OAUTH_CLIENT_SECRET: 'mock-client-secret',
        GMAIL_OAUTH_REFRESH_TOKEN: 'mock-refresh-token',
        SMTP_HOST: 'smtp.resend.com',
        SMTP_USER: 'resend',
        SMTP_PASSWORD: 'resend-password',
      });

      expect(resolved.type).toBe('gmail_oauth');
      expect(resolved.options).toEqual({
        clientId: 'mock-client-id.apps.googleusercontent.com',
        clientSecret: 'mock-client-secret',
        refreshToken: 'mock-refresh-token',
      });
    });
  });

  describe('sendViaGmailApi', () => {
    let mockSend: jest.Mock;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      mockSend = jest.fn().mockResolvedValue({
        data: { id: 'gmail-message-12345' },
      });

      jest.spyOn(google, 'gmail').mockReturnValue({
        users: {
          messages: {
            send: mockSend,
          },
        },
      } as any);

      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('invokes gmail.users.messages.send with userId "me" and base64url raw payload', async () => {
      const result = await sendViaGmailApi(
        {
          from: 'alumniconnect@gmail.com',
          to: 'alumni@example.com',
          subject: 'Your OTP Code',
          text: 'Your code is 123456',
          html: '<p>Your code is 123456</p>',
        },
        {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          refreshToken: 'test-refresh-token',
        }
      );

      expect(result.messageId).toBe('gmail-message-12345');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.userId).toBe('me');
      expect(typeof callArgs.requestBody.raw).toBe('string');
      // Verify raw does not contain disallowed base64 chars (+, /, =)
      expect(callArgs.requestBody.raw).not.toContain('+');
      expect(callArgs.requestBody.raw).not.toContain('/');
      expect(callArgs.requestBody.raw).not.toContain('=');
    });

    it('catches invalid_grant error specifically and logs clear actionable warning', async () => {
      const invalidGrantError = new Error('invalid_grant');
      (invalidGrantError as any).response = {
        data: {
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        },
      };

      mockSend.mockRejectedValueOnce(invalidGrantError);

      await expect(
        sendViaGmailApi(
          {
            from: 'alumniconnect@gmail.com',
            to: 'alumni@example.com',
            subject: 'Test Subject',
            text: 'Test Body',
          },
          {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            refreshToken: 'test-refresh-token',
          }
        )
      ).rejects.toThrow('invalid_grant');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('GMAIL OAUTH ERROR: Gmail OAuth refresh token expired or revoked — re-run get-gmail-refresh-token.ts')
      );
      // Ensure secrets are never logged
      const loggedCalls = consoleErrorSpy.mock.calls.map((c) => c.join(' ')).join(' ');
      expect(loggedCalls).not.toContain('test-client-secret');
      expect(loggedCalls).not.toContain('test-refresh-token');
    });
  });
});
