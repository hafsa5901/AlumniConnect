import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import path from 'path';
import { google } from 'googleapis';

// Load environment variables from .env files
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clientId = process.env.GMAIL_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n❌ ERROR: GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET must be set in your .env file or environment.');
  console.error('Please configure these values first, then re-run this script.\n');
  process.exit(1);
}

const PORT = parseInt(process.env.OAUTH_REDIRECT_PORT || '3000', 10);
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Required to ensure a refresh token is returned
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url || '', true);
    const code = parsedUrl.query.code as string;
    const error = parsedUrl.query.error as string;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Authentication Failed</h1><p>Error: ${error}</p>`);
      console.error(`\n❌ Authorization failed: ${error}`);
      server.close();
      process.exit(1);
    }

    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication Successful!</h1><p>You can close this tab and return to your terminal.</p>');

      console.log('\n✅ Authorization code received! Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        console.warn('\n⚠️ WARNING: Google did not return a refresh token.');
        console.warn('This typically happens if prompt=consent was omitted or permission was already granted.');
        console.warn('Try visiting https://myaccount.google.com/permissions to revoke access for this app, then re-run this script.');
      } else {
        console.log('\n═══════════════════════════════════════════════════════════════════');
        console.log('🎉 YOUR GMAIL OAUTH REFRESH TOKEN IS:');
        console.log('───────────────────────────────────────────────────────────────────');
        console.log(tokens.refresh_token);
        console.log('───────────────────────────────────────────────────────────────────');
        console.log('📋 Next Steps:');
        console.log('1. Copy the refresh token above.');
        console.log('2. Add it to your local .env as: GMAIL_OAUTH_REFRESH_TOKEN=<token>');
        console.log('3. Set EMAIL_FROM to the sending Gmail address.');
        console.log('4. Also add GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET,');
        console.log('   GMAIL_OAUTH_REFRESH_TOKEN, and EMAIL_FROM to Render Environment.');
        console.log('═══════════════════════════════════════════════════════════════════\n');
      }

      server.close();
      process.exit(0);
    }
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Error exchanging token</h1>');
    console.error('\n❌ Token exchange error:', err?.message || err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🚀 GMAIL OAUTH2 ONE-TIME AUTHORIZATION HELPER');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\n1. Open the following URL in your browser:\n`);
  console.log(`   ${authUrl}\n`);
  console.log(`2. Sign in with the Gmail account you want to send emails from.`);
  console.log(`3. Click "Continue" through the unverified app warning (expected in Testing mode).`);
  console.log(`4. Grant permission. You will be redirected back to 127.0.0.1:${PORT}.`);
  console.log(`\nWaiting for authorization...\n`);
});
