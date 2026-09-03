import { expect, test, type Page } from '@playwright/test';
import { connectTestDb } from './db';

/**
 * Issue F1-04. Zawężenie unieważniania ścieżek ma sens tylko wtedy, gdy nic po
 * drodze nie przestaje się odświeżać. Pięć scenariuszy pilnuje dokładnie tego:
 * mutacja przez interfejs, a potem widok docelowy pokazujący nowe dane bez
 * twardego przeładowania strony.
 *
 * Scenariusz „wpis kalendarza" z kryterium akceptacji jest zastąpiony
 * scenariuszem „krok produkcji widoczny w kalendarzu": wpisu kalendarza nie da
 * się dziś dodać z interfejsu (znalezisko F7-09), a oś czasu w `/calendar`
 * i tak rysuje się z kroków produkcji, więc to ta sama ścieżka odświeżania.
 */

const EMAIL = process.env.AUTH_EMAIL;
const PASSWORD = process.env.AUTH_PASSWORD;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Hasło').fill(PASSWORD!);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Dodaje osobę przez formularz na /artists i zwraca jej nazwę. */
async function createArtist(page: Page, prefix: string): Promise<string> {
  const name = `${prefix} ${Date.now()}`;
  await page.goto('/artists');
  await page.getByRole('button', { name: /dodaj artyst/i }).click();
  await page.getByLabel('Imię / Nazwa *').fill(name);
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });
  return name;
}

/** Tworzy produkcję kreatorem i zwraca jej tytuł. */
async function createProduction(page: Page): Promise<string> {
  // Kreator wymaga przypisanego artysty także dla typu solo, więc osoba
  // musi powstać wcześniej.
  const artist = await createArtist(page, 'Artysta F1-04');
  const title = `Prod F1-04 ${Date.now()}`;
  await page.goto('/productions');
  // F7-39: klik w guzik przed zhydrowaniem strony nie robi nic, a `/productions`
  // z 500 produkcjami w bazie testowej hydruje się zauważalnie długo. Playwright
  // sprawdza widoczność, nie gotowość Reacta, więc czekamy na koniec ładowania.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ Nowa produkcja' }).click();
  // Typ „Solo": nie wymaga przypisanego artysty, więc kreator przechodzi
  // do końca także na czystej bazie.
  await page.getByRole('button', { name: /^Solo/ }).click();
  await page.getByRole('button', { name: /^Dalej$/ }).click();
  await page.getByLabel('Tytuł produkcji').fill(title);
  await page.getByRole('button', { name: artist, exact: true }).click();
  await page.getByRole('button', { name: /^Dalej$/ }).click();
  await page.getByRole('button', { name: 'Utwórz produkcję' }).click();
  // Kreator po zapisie przenosi na stronę nowej produkcji.
  await page.waitForURL(/\/productions\/\d+$/, { timeout: 20_000 });
  return title;
}

// F7-21: scenariusze zakładają artystów, produkcje i kampanię; baza testowa
// jest czyszczona przed przebiegiem, ale sprzątamy też po sobie, żeby dwa
// przebiegi pod rząd na tym samym serwerze nie zostawiały narastających kopii.
const sql = connectTestDb();
test.afterAll(async () => {
  await sql`delete from productions where title like 'Prod F1-04%'`;
  await sql`delete from campaigns where name like 'Kampania F1-04%'`;
  await sql`delete from artists where name like 'Artysta F1-04%' or name like 'Osoba F1-04%'`;
  await sql.end();
});

test.beforeEach(async ({ page }) => {
  expect(EMAIL, 'AUTH_EMAIL musi być w .env.local').toBeTruthy();
  expect(PASSWORD, 'AUTH_PASSWORD musi być w .env.local').toBeTruthy();
  await login(page);
});

test('produkcja: po utworzeniu widać ją na /productions bez odświeżenia', async ({ page }) => {
  const title = await createProduction(page);
  await page.goto('/productions/list');
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
});

test('krok produkcji: odhaczenie zostaje po powrocie na stronę produkcji', async ({ page }) => {
  await createProduction(page);
  const url = page.url();

  // Krok odhacza się przyciskiem z etykietą „Odhacz krok: …"; po zapisie
  // etykieta zmienia się na „Cofnij krok: …".
  const toggle = page.getByRole('button', { name: /^Odhacz krok:/ }).first();
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  const label = (await toggle.getAttribute('aria-label'))!.replace('Odhacz krok: ', '');
  await toggle.click();
  await expect(page.getByRole('button', { name: `Cofnij krok: ${label}` })).toBeVisible({
    timeout: 20_000,
  });

  // Wyjście i powrót nawigacją klienta, bez reload(): stan musi przyjść
  // z serwera, a nie z pamięci komponentu.
  await page.goto('/productions');
  await page.goto(url);
  await expect(page.getByRole('button', { name: `Cofnij krok: ${label}` })).toBeVisible({
    timeout: 20_000,
  });
});

test('krok produkcji: kalendarz pokazuje nową produkcję na osi', async ({ page }) => {
  const title = await createProduction(page);
  await page.goto('/calendar?mode=table');
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
});

test('kampania: po utworzeniu widać ją na liście kampanii', async ({ page }) => {
  const name = `Kampania F1-04 ${Date.now()}`;
  await page.goto('/campaigns');
  await page.getByRole('button', { name: /nowa kampania/i }).click();
  // Krok 1 to wybór szablonu narracji, dopiero krok 2 pyta o nazwę.
  await page.getByRole('button', { name: /Premiera singla|Cykl content/i }).first().click();
  await page.getByRole('button', { name: /^Dalej$/ }).click();
  await page.getByLabel('Nazwa kampanii').fill(name);
  await page.getByLabel('Wizja / cel narracji').fill('Cel testowy dla scenariusza F1-04.');
  await page.getByRole('button', { name: /^Dalej$/ }).click();
  await page.getByRole('button', { name: 'Utwórz kampanię' }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });

  await page.goto('/campaigns/list');
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
});

test('osoba: po dodaniu widać ją na /artists i po powrocie z innej strony', async ({ page }) => {
  const name = `Osoba F1-04 ${Date.now()}`;
  await page.goto('/artists');
  await page.getByRole('button', { name: /dodaj artyst/i }).click();
  await page.getByLabel('Imię / Nazwa *').fill(name);
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });

  await page.goto('/');
  await page.goto('/artists');
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 20_000 });
});
