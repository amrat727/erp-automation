import { consistencySuite } from './master-ui';
import { PRODUCT_SCREENS } from './product.config';

/* CORE > PRODUCT - UI / UX consistency: the SAME checks as Region (see master-ui.ts) */
consistencySuite('PRD', 'Product', PRODUCT_SCREENS);
