import 'dotenv/config';

/**
 * Base URLs and credentials come from the environment (.env locally, workflow env in CI), with the public practice
 * sites as defaults. Restful-Booker's admin/password123 is a published demo credential, not a secret; it is still read
 * from the environment so a private deployment of the API could use its own.
 */
export const env = {
  uiBaseUrl: process.env.UI_BASE_URL ?? 'https://blazedemo.com',
  apiBaseUrl: process.env.API_BASE_URL ?? 'https://restful-booker.herokuapp.com',
  apiUsername: process.env.API_USERNAME ?? 'admin',
  apiPassword: process.env.API_PASSWORD ?? 'password123',
};
