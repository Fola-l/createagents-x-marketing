export function randomDelay(minSeconds: number, maxSeconds: number) {
  const min = Math.max(0, Math.floor(minSeconds));
  const max = Math.max(min, Math.floor(maxSeconds));

  const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
  const ms = seconds * 1000;

  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
