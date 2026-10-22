import { languages, rightToLeft } from "../assets/languages";
import { publicOrigin } from "./page";

interface RewriterElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string, options?: { html: boolean }): void;
}

declare class HTMLRewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void }): HTMLRewriter;
  transform(response: Response): Response;
}

type Strings = Record<string, string | undefined>;

const codes: readonly string[] = languages.map(([code]) => code).filter((code) => code !== "en");
const pageLink = /^\/(?!\/|assets\/)[^.?#]*(?:[?#].*)?$/u;

export async function localized(
  request: Request,
  serve: (request: Request) => Promise<Response>,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  const [, code = "", ...rest] = url.pathname.split("/");
  if (!codes.includes(code)) return undefined;
  if (rest.length === 0) return redirect(`/${code}/${url.search}`, 301);
  url.pathname = `/${rest.join("/")}`;
  const response = await serve(new Request(url, request));
  const location = response.headers.get("location");
  if (location?.startsWith("/")) return redirect(`/${code}${location}`, response.status);
  if (response.headers.get("content-type")?.startsWith("text/html") !== true) return response;
  const strings: Strings = (await import(`../locales/${code}.json`)).default;
  return translate(response, code, strings);
}

function translate(response: Response, code: string, strings: Strings): Response {
  const translated = (
    attribute: string,
    write: (element: RewriterElement, value: string) => void,
  ) => ({
    element(element: RewriterElement) {
      const value = strings[element.getAttribute(attribute) ?? ""];
      if (value !== undefined) write(element, value);
    },
  });
  const localize = (attribute: string) => ({
    element(element: RewriterElement) {
      const address = element.getAttribute(attribute) ?? "";
      element.setAttribute(attribute, address.replace(publicOrigin, `${publicOrigin}/${code}`));
    },
  });
  return new HTMLRewriter()
    .on("html", {
      element(element) {
        element.setAttribute("lang", code);
        element.setAttribute("dir", rightToLeft.has(code) ? "rtl" : "ltr");
      },
    })
    .on(
      "[data-i18n]",
      translated("data-i18n", (element, value) => element.setInnerContent(value)),
    )
    .on(
      "[data-i18n-html]",
      translated("data-i18n-html", (element, value) =>
        element.setInnerContent(value, { html: true }),
      ),
    )
    .on("[data-i18n-attr]", {
      element(element) {
        const [attribute = "", key = ""] = (element.getAttribute("data-i18n-attr") ?? "").split(
          "=",
        );
        const value = strings[key];
        if (value !== undefined) element.setAttribute(attribute, value);
      },
    })
    .on('link[rel="canonical"]', localize("href"))
    .on('meta[property="og:url"]', localize("content"))
    .on('a[href^="/"]', {
      element(element) {
        const href = element.getAttribute("href") ?? "";
        if (pageLink.test(href)) element.setAttribute("href", `/${code}${href}`);
      },
    })
    .transform(response);
}

function redirect(location: string, status: number): Response {
  return new Response(null, { status, headers: { location } });
}
