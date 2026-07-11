export function deepFreeze<T>(value: T): T {
  freezeValue(value, new WeakSet<object>());
  return value;
}

function freezeValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object') return;

  const objectValue = value as Record<PropertyKey, unknown>;
  if (seen.has(objectValue)) return;
  seen.add(objectValue);

  for (const key of Reflect.ownKeys(objectValue)) {
    freezeValue(objectValue[key], seen);
  }

  Object.freeze(objectValue);
}
