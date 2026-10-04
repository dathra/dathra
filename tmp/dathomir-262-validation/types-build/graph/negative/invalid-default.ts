import { clientModule } from '@dathra/core/server';
const ref = clientModule('./invalid-default.client.js', import.meta.url);
export { ref };
