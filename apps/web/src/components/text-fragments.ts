/** Source offsets distinguish repeated text fragments without relying on their array index. */
export function textFragments<T extends { text: string }>(fragments: readonly T[]) {
  let offset = 0;
  return fragments.map((fragment) => {
    const start = offset;
    offset += fragment.text.length;
    return { ...fragment, start };
  });
}
