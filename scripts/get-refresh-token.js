#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { exec, execSync } = require('child_process');
const readline = require('readline');

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const clientId = process.argv[2] || process.env.CHROME_CLIENT_ID || await prompt('Enter Chrome Client ID: ');
  const clientSecret = process.argv[3] || process.env.CHROME_CLIENT_SECRET || await prompt('Enter Chrome Client Secret: ');

  if (!clientId || !clientSecret) {
    console.error('Client ID and Client Secret are required.');
    process.exit(1);
  }

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      redirect_uri: redirectUri,
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  console.log('\n========================================');
  console.log('ブラウザで以下の URL を開いて認証してください:');
  console.log(authUrl);
  console.log('========================================\n');

  try {
    exec(`open "${authUrl}"`);
  } catch {
    // Ignore error if open fails
  }

  const code = await new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const reqUrl = new URL(req.url, `http://${req.headers.host}`);
      const codeParam = reqUrl.searchParams.get('code');
      const errorParam = reqUrl.searchParams.get('error');

      if (codeParam) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>認証に成功しました！</h1><p>このタブを閉じてターミナルに戻ってください。</p>');
        server.close();
        resolve(codeParam);
      } else if (errorParam) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>エラーが発生しました</h1><p>${errorParam}</p>`);
        server.close();
        reject(new Error(errorParam));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });

  console.log('認証コードを取得しました。リフレッシュトークンと交換中...');

  const tokenData = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri);
  if (!tokenData.refresh_token) {
    console.error('リフレッシュトークンが取得できませんでした:', tokenData);
    process.exit(1);
  }

  console.log('\n✅ リフレッシュトークンの取得に成功しました！\n');
  console.log(`CHROME_CLIENT_ID=${clientId}`);
  console.log(`CHROME_CLIENT_SECRET=${clientSecret}`);
  console.log(`CHROME_REFRESH_TOKEN=${tokenData.refresh_token}`);

  console.log('\nGitHub Secrets への登録を実行中...');
  try {
    execSync(`gh secret set CHROME_CLIENT_ID --body "${clientId}"`, { stdio: 'inherit' });
    execSync(`gh secret set CHROME_CLIENT_SECRET --body "${clientSecret}"`, { stdio: 'inherit' });
    execSync(`gh secret set CHROME_REFRESH_TOKEN --body "${tokenData.refresh_token}"`, { stdio: 'inherit' });
    console.log('🎉 GitHub Secrets への登録が完了しました！');
  } catch (err) {
    console.error('GitHub Secrets への登録でエラーが発生しました:', err.message);
  }
}

function exchangeCodeForToken(clientId, clientSecret, code, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString();

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
