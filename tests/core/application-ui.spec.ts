import { consistencySuite } from './master-ui';
import { APPLICATION_SCREENS } from './application.config';

/* CORE > APPLICATION - UI / UX consistency (the shared checks live in master-ui.ts; all saves are blocked) */
consistencySuite('APP', 'Application', APPLICATION_SCREENS);
