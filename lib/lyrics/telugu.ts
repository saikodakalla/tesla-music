/** Search-only transliteration; never replaces the displayed lyric text. */
export function transliterateTelugu(text: string): string {
  const consonants: Record<string, string> = {
    క: "k", ఖ: "kh", గ: "g", ఘ: "gh", ఙ: "ng", చ: "ch", ఛ: "chh", జ: "j", ఝ: "jh", ఞ: "ny",
    ట: "t", ఠ: "th", డ: "d", ఢ: "dh", ణ: "n", త: "t", థ: "th", ద: "d", ధ: "dh", న: "n",
    ప: "p", ఫ: "ph", బ: "b", భ: "bh", మ: "m", య: "y", ర: "r", ఱ: "r", ల: "l", ళ: "l",
    వ: "v", శ: "sh", ష: "sh", స: "s", హ: "h",
  };
  const signs: Record<string, string> = { "ా": "aa", "ి": "i", "ీ": "ee", "ు": "u", "ూ": "oo", "ృ": "ru", "ౄ": "roo", "ె": "e", "ే": "e", "ై": "ai", "ొ": "o", "ో": "o", "ౌ": "au", "్": "" };
  const vowels: Record<string, string> = { అ: "a", ఆ: "aa", ఇ: "i", ఈ: "ee", ఉ: "u", ఊ: "oo", ఋ: "ru", ఎ: "e", ఏ: "e", ఐ: "ai", ఒ: "o", ఓ: "o", ఔ: "au", "ం": "m", "ఁ": "m", "ః": "h" };
  const chars = Array.from(text.normalize("NFC"));
  let result = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (consonants[char]) {
      const next = chars[i + 1];
      result += consonants[char];
      if (next !== undefined && Object.prototype.hasOwnProperty.call(signs, next)) { result += signs[next]; i++; }
      else result += "a";
    } else result += vowels[char] ?? char;
  }
  return result;
}
