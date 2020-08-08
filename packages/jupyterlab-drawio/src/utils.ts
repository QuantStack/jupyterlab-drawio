export function stripDataURI(raw: string) {
  return raw.split(',')[1];
}

export function unbase64SVG(raw: string) {
  return atob(stripDataURI(raw));
}
