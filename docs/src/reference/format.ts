function encodeReferenceData<T>(data: T): string {
  return JSON.stringify(data);
}

function decodeReferenceData<T>(value: string, fallback: T): T {
  if (value.trim() === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export { decodeReferenceData, encodeReferenceData };
