declare module "*.css";

declare module "*.txt" {
  const text: string;
  export default text;
}

interface ImportMeta {
  glob<T>(pattern: string, options: { import: "default" }): Record<string, () => Promise<T>>;
}
