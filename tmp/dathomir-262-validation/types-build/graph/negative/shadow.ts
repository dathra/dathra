function clientModule(specifier: string, baseURL: string) { return { specifier, baseURL }; }
const ordinary = clientModule('./anything.js', import.meta.url);
export { ordinary };
