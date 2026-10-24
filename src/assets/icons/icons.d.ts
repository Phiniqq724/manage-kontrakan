// Local Material Symbols drawables (e.g. filled variants the package doesn't
// ship), added with `bunx add-material-symbols --fill -o ./src/assets/icons`.
// Import them by relative path: Metro doesn't apply the "@/" alias to assets.
declare module "*_fill.xml" {
  const src: number;
  export default src;
}
