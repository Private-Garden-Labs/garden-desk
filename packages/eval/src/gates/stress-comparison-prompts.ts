import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** With --without-specialists or --without-review, Core loads a prompt copy without those workflows. */
export async function preparePrompts(
  source: string,
  copy: string,
  options: { withoutSpecialists: boolean; withoutReview: boolean },
): Promise<string> {
  if (!options.withoutSpecialists && !options.withoutReview) return source;
  await rm(copy, { recursive: true, force: true });
  await cp(source, copy, { recursive: true });
  if (options.withoutSpecialists) {
    for (const name of [
      "matter-chronology",
      "contract-obligations",
      "document-comparison",
      "financial-review",
    ])
      await rm(join(copy, "agents", `${name}.md`));
    for (const name of ["obligations", "reconcile", "expenses"])
      await rm(join(copy, "commands", `${name}.md`));
  }
  if (options.withoutReview) await removeReview(copy);
  return copy;
}

async function removeReview(copy: string): Promise<void> {
  await rm(join(copy, "commands", "review.md"));
  const primary = join(copy, "agents", "primary.md");
  const text = await readFile(primary, "utf8");
  if (!text.includes(", review]") || !/^1\. `review`:.*$/mu.test(text))
    throw new Error("review_route_missing");
  await writeFile(primary, text.replace(", review]", "]").replace(/^1\. `review`:.*\r?\n/mu, ""));
}
