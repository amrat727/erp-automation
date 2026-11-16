import { consistencySuite } from './master-ui';
import { ORGANIZATION_SCREENS } from './organization.config';

/* CORE > ORGANIZATION - UI / UX consistency (the shared checks live in master-ui.ts; all saves are blocked) */
consistencySuite('ORG', 'Organization', ORGANIZATION_SCREENS);
