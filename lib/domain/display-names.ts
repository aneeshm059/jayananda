export const soulfulAuthor = 'His Grace Madhupandit Dasa';

// Honorifics are a display preference; the archived source stays verbatim.
export function respectfulAuthor(text: string) {
  return text.replace(
    /\b(?:(?:His Grace|Sri\.?)\s+)?Madhu[ -]?Pandit\s+(?:D[aā]sa|Prabhu)\b/gi,
    soulfulAuthor,
  );
}
