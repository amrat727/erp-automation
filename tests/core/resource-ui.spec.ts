import { consistencySuite } from './master-ui';
import { RESOURCE_SCREENS } from './resource.config';

/* CORE > RESOURCE - UI / UX consistency (the shared checks live in master-ui.ts; all saves are blocked) */
consistencySuite('RES', 'Resource', RESOURCE_SCREENS);
