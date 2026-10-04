import { privateText } from '../private-data.js';
import { defineClient } from '@dathra/core/client';
function label() { return privateText; }
export default defineClient({ label });
