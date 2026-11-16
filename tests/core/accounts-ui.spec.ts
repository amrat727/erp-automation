import { consistencySuite } from './master-ui';
import { ACCOUNTS_SCREENS } from './accounts.config';

/* CORE > ACCOUNTS > CONFIGURATION - UI / UX consistency (shared checks in master-ui.ts; all saves are blocked) */
consistencySuite('ACC', 'Accounts > Configuration', ACCOUNTS_SCREENS);
