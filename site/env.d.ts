declare module "*.css";

declare module "flag-icons/flags/4x3/*.svg?no-inline" {
  const url: string;
  export default url;
}

declare module "*.txt" {
  const text: string;
  export default text;
}

interface ImportMeta {
  glob<T>(pattern: string, options: { import: "default" }): Record<string, () => Promise<T>>;
}
