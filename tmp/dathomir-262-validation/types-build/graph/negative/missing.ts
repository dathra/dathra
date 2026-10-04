import { clientModule } from '@dathra/core/server';
const ref = clientModule('./absent.client.js', import.meta.url);
export { ref };
