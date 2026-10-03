import orientation from '@/data/soulful-japa-image-orientation.json';

const reflectedFigures = new Set(orientation.flipY);

// The source PDF reflects these raw embedded images in its placement matrix.
// Keep their original bytes and reproduce that placement in both reader views.
export function soulfulImageTransform(src?: string) {
  return src && reflectedFigures.has(src) ? 'scaleY(-1)' : undefined;
}
