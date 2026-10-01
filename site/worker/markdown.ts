import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export function markdown(source: string): string {
  return micromark(source, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
    .replaceAll("<table>", '<div class="table-scroll"><table>')
    .replaceAll("</table>", "</table></div>");
}
