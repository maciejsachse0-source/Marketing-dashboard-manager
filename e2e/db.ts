import postgres from 'postgres';

/**
 * Połączenie z bazą, na której stoi serwer testowy (F7-21). Runner ma
 * w środowisku DATABASE_URL bazy roboczej, ale `scripts/e2e-serve.mjs`
 * uruchamia aplikację na TEST_DATABASE_URL — scenariusze, które zaglądają
 * do bazy, muszą patrzeć tam, gdzie pisze serwer.
 */
export function connectTestDb() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;
  return postgres(url, { prepare: false, max: 2 });
}
