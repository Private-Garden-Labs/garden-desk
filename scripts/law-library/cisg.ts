import type { Section, Source } from "./sources.js";
import { cite, markupToText } from "./text.js";

/** Justice Laws Canada XML of S.C. 1991, c. 13: the Convention is the Schedule, one group per article. */
export function cisgSections(xml: string, source: Source): Section[] {
  const schedule = xml.slice(xml.indexOf("<Schedule"));
  const sections: Section[] = [];
  let heading = "";
  for (const group of schedule.split(/<GroupHeading\b[^>]*>/u).slice(1)) {
    const end = group.indexOf("</GroupHeading>");
    const title = markupToText(/<TitleText>([\s\S]*?)<\/TitleText>/u.exec(group)?.[1] ?? "");
    if (!/^Article \d+$/u.test(title)) {
      heading = title;
      continue;
    }
    const body = group
      .slice(end)
      .replace(/<Label>([\s\S]*?)<\/Label>/gu, "$1 ")
      .replace(/<\/Text>/gu, "</p>");
    sections.push({ citation: cite(source.citation, title), heading, text: markupToText(body) });
  }
  return sections;
}
