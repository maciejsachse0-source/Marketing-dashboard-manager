// Porównanie dwóch PNG piksel po pikselu. Zwraca liczbę różniących się pikseli.
// Dekodowanie przez chromium z playwrighta — repo nie ma biblioteki graficznej.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const [, , a, b] = process.argv;
const toUrl = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const diff = await page.evaluate(async ([ua, ub]) => {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const [ia, ib] = await Promise.all([load(ua), load(ub)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return -1;
  const px = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
  };
  const pa = px(ia), pb = px(ib);
  let n = 0;
  for (let i = 0; i < pa.length; i += 4) {
    if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) n++;
  }
  return n;
}, [toUrl(a), toUrl(b)]);
await browser.close();
console.log(diff === -1 ? 'ROZNE WYMIARY' : `roznych pikseli: ${diff}`);
