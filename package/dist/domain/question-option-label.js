const RECOMMENDED_SUFFIX = /\s*\(recommended\)\s*$/i;

export function displayOptionLabel(label        )         {
  const shown = label.replace(RECOMMENDED_SUFFIX, "");
  return shown || label;
}
