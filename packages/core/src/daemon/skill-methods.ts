import { type RpcRequest, type RpcResponse, SkillNameSchema } from "@gardendesk/shared";
import type { GardenDeskCore } from "../facade.js";
import { failure, success } from "./responses.js";

function skillName(request: RpcRequest): string {
  const parsed = SkillNameSchema.safeParse(request.params.name);
  if (!parsed.success) throw new Error("invalid_skill_name");
  return parsed.data;
}

export async function dispatchSkillMethod(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  switch (request.method) {
    case "skills.list":
      return success(request, await core.listSkills());
    case "skills.locations":
      return success(request, await core.skillLocations());
    case "skills.install": {
      const { paths } = request.params;
      if (!Array.isArray(paths) || paths.length === 0 || paths.some((p) => typeof p !== "string")) {
        return failure(request, "invalid_request", "Invalid skill files.");
      }
      return success(request, await core.installSkills(paths as string[]));
    }
    case "skills.read":
      return success(request, { content: await core.readSkill(skillName(request)) });
    case "skills.write": {
      const { content } = request.params;
      if (typeof content !== "string") {
        return failure(request, "invalid_request", "Invalid skill content.");
      }
      return success(request, { saved: await core.writeSkill(skillName(request), content) });
    }
    case "skills.remove":
      return success(request, { removed: await core.removeSkill(skillName(request)) });
    default: {
      const { enabled } = request.params;
      if (typeof enabled !== "boolean") {
        return failure(request, "invalid_request", "Invalid skill state.");
      }
      return success(request, { changed: await core.setSkillEnabled(skillName(request), enabled) });
    }
  }
}
