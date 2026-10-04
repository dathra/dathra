import { audit } from '../private.server.js';
import { defineClient } from '@dathra/core/client';
function label() { return audit(); }
export default defineClient({ label });
