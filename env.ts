import 'dotenv/config';

/*
 * ONE place for the addresses of the system under test.
 * Default = the current test environment; override in .env (or a CI secret) to run the SAME suite elsewhere:
 *   BASE_URL=https://erp.nexgenpilot.com        (back-office ERP)
 *   API_HOST=pilottest.runasp.net               (the API the ERP calls - used to block / watch saves)
 *   B2B_URL=https://b2b.nexgenpilot.com         (agent portal)
 */
export const BASE_URL = (process.env.BASE_URL || 'https://erp.nexgenpilot.com').replace(/\/$/, '');
export const API_HOST = process.env.API_HOST || 'pilottest.runasp.net';
export const API_URL = `https://${API_HOST}`;
export const B2B_URL = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
