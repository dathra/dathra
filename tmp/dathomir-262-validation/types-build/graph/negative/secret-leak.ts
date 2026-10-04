import { clientModule } from '@dathra/core/server';
const ref = clientModule('./secret-leak.client.js', import.meta.url);
export { ref };
