import assert from "node:assert/strict";
import test from "node:test";
import { GLASSES_UI_TOOL_DESCRIPTION } from "./glasses-ui-tool.ts";

test("description now carries the follow-up + back/selected usage rules", () => {
  const d = GLASSES_UI_TOOL_DESCRIPTION;
  assert.match(d, /text_surface/);
  assert.match(d, /list_surface/);
  assert.match(d, /list_with_details_surface/);

  assert.match(d, /NEXT output|next output/);
  assert.match(d, /back/i);
  assert.match(d, /selected/i);

  assert.match(d, /glasses-ui/);
});
