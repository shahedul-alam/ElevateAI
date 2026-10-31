// "React.js", "react js" and "ReactJS" must resolve to the same alias key. '+' and '#' stay so
// "c++" and "c#" remain distinct from "c".
export const normalizeAlias = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s._\-/]+/g, '')
