import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function markdown(source: string): string {
  return renderToStaticMarkup(
    createElement(
      Markdown,
      {
        skipHtml: true,
        remarkPlugins: [remarkGfm],
        components: {
          table: ({ children }) =>
            createElement(
              "div",
              { className: "table-scroll" },
              createElement("table", null, children),
            ),
        },
      },
      source,
    ),
  );
}
