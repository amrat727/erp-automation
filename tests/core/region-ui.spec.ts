import { consistencySuite } from './master-ui';
import { REGION_SCREENS } from './region.config';

/* CORE > REGION - UI / UX consistency (the shared checks live in master-ui.ts) */
consistencySuite('RGN', 'Region', REGION_SCREENS);
