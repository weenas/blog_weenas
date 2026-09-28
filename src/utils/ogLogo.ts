// Weenas logo (navy/blue on light), inlined for Satori OG images.
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 450"><g transform="translate(20 12)"><path d="M 0 22 Q 0 5 17 12 L 108 62 L 108 313 L 250 228 L 250 319 L 92 410 Q 80 418 67 410 L 10 369 Q 0 363 0 351 Z" fill="#061B3C"/><path d="M 126 74 L 218 125 Q 225 129 225 137 L 225 218 L 126 278 Z" fill="#0866FF"/><g transform="translate(500 0) scale(-1 1)"><path d="M 0 22 Q 0 5 17 12 L 108 62 L 108 313 L 250 228 L 250 319 L 92 410 Q 80 418 67 410 L 10 369 Q 0 363 0 351 Z" fill="#061B3C"/><path d="M 126 74 L 218 125 Q 225 129 225 137 L 225 218 L 126 278 Z" fill="#0866FF"/></g></g></svg>`;

export const ogLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(
  logoSvg
).toString("base64")}`;
