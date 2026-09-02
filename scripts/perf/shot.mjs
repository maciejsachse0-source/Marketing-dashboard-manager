import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { chromium } from 'playwright';
const [,, out, ...paths] = process.argv;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:3000/login');
await p.getByLabel('Email').fill(process.env.AUTH_EMAIL);
await p.getByLabel('Hasło').fill(process.env.AUTH_PASSWORD);
await p.getByRole('button', { name: /zaloguj/i }).click();
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
for (const path of paths) {
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
  const name = path.replace(/\//g, '_').replace(/^_/, '') || 'home';
  await p.screenshot({ path: `screenshots/${out}-${name}.png`, fullPage: true });
  console.log(`screenshots/${out}-${name}.png`);
}
await b.close();
