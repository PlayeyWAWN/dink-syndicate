/** Remove undefined values so Firestore setDoc/updateDoc do not reject the payload. */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        next[key] = stripUndefinedDeep(entry);
      }
    }
    return next as T;
  }

  return value;
}
