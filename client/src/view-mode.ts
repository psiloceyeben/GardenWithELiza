/** One selection for startup, world models and wardrobe previews. */
export function viewMode(search: string): { legacy: boolean; perspective: boolean; wander: boolean } {
  const params = new URLSearchParams(search);
  const legacy = params.get('r') === '2d';
  const perspective = !legacy && params.get('view') !== 'orthographic';
  return { legacy, perspective, wander: perspective && params.get('characters') !== 'sprites' };
}
