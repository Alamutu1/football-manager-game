/**
 * Type declarations for CSS imports used by the template's web files.
 * Metro handles these at runtime; TypeScript just needs to know the
 * modules exist.
 */
declare module '*.css';
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
