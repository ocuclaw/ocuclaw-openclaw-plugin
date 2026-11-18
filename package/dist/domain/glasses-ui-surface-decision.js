import { createHash } from "node:crypto";
import { JEV_ROUND_5_QUESTIONS } from "./glasses-ui-jev-round-5.js";
import { LIVEUI_JEV_RULES } from "./glasses-ui-jev-rules.generated.js";

export const FLOORS = LIVEUI_JEV_RULES.floors;

export const JEV_MODEL_ID = LIVEUI_JEV_RULES.model;

export const JEV_ROUND = LIVEUI_JEV_RULES.round;

export const JEV_ROUND_5 = 5;

export const RENDER_SHAPE = LIVEUI_JEV_RULES.renderShape;

export const CHAT_SHAPES = LIVEUI_JEV_RULES.chatShapes;

export const KIND_REASON = LIVEUI_JEV_RULES.lines.kindReason;

export const UNKINDED_REASON = LIVEUI_JEV_RULES.lines.unkindedReason;

export const DECIDED_RENDER_TAIL = LIVEUI_JEV_RULES.lines.renderTail;
export const DECIDED_RENDER_TAIL_UNKINDED = LIVEUI_JEV_RULES.lines.renderTailUnkinded;
export const DECIDED_CHAT = LIVEUI_JEV_RULES.lines.chat;

export const DECIDED_RENDER_SKIP_GUIDE = LIVEUI_JEV_RULES.lines.skipGuide;

export const DECIDED_RENDER_SKIP_GUIDE_HERMES = DECIDED_RENDER_SKIP_GUIDE.replace(
  "the glasses-ui skill",
  "the ocuclaw:glasses-ui skill",
);

export function surfaceDecisionLineForHermes(line        )         {
  return line.split(DECIDED_RENDER_SKIP_GUIDE).join(DECIDED_RENDER_SKIP_GUIDE_HERMES);
}

const TAG = "surface_decision";

export const SURFACE_DECISION_SCOPE = LIVEUI_JEV_RULES.lines.scope;

export const DECIDED_V2_FRAMED = LIVEUI_JEV_RULES.lines.v2Framed;
export const DECIDED_V2_UNFRAMED = LIVEUI_JEV_RULES.lines.v2Unframed;
export const DECIDED_V2_TAIL = LIVEUI_JEV_RULES.lines.v2Tail;
export const DECIDED_V2_OPEN_SURFACE = LIVEUI_JEV_RULES.lines.v2OpenSurface;

export const DECIDED_V2_CHAT = LIVEUI_JEV_RULES.lines.v2Chat;

export const FRAME_CARDS                                   = LIVEUI_JEV_RULES.cards;

export const FRAME_TRUST                                   = LIVEUI_JEV_RULES.frameTrust;

export function trustedFrameCard(frame     , confidence     )                {
  if (typeof frame !== "string" || !Number.isFinite(confidence)) return null;
  if (!Object.prototype.hasOwnProperty.call(FRAME_TRUST, frame)) return null;
  if (confidence < FRAME_TRUST[frame]) return null;
  return Object.prototype.hasOwnProperty.call(FRAME_CARDS, frame) ? FRAME_CARDS[frame] : null;
}

export function composeV2SurfaceDecision(decided     , options                            = {}) {
  if (!decided || !decided.decision) return decided;
  if (decided.decision.line === "chat") {
    return {
      block: wrapBlock(DECIDED_V2_CHAT),
      oneLine: wrapOneLine(DECIDED_V2_CHAT),
      decision: { ...decided.decision, line: "v2_chat" },
    };
  }
  if (decided.decision.shape !== RENDER_SHAPE) return decided;
  const openSurface = Boolean(options && options.openSurface);
  const card = openSurface ? null : trustedFrameCard(decided.decision.frame, decided.decision.frameConfidence);
  const body = openSurface
    ? DECIDED_V2_OPEN_SURFACE
    : card
      ? `${DECIDED_V2_FRAMED.replace("<card>", card)} ${DECIDED_V2_TAIL}`
      : `${DECIDED_V2_UNFRAMED} ${DECIDED_V2_TAIL}`;
  return {
    block: wrapBlock(body),
    oneLine: wrapOneLine(body),
    decision: {
      ...decided.decision,
      line: openSurface ? "v2_open_surface" : card ? "v2_framed" : "v2_unframed",
      cardApplied: card !== null,
    },
  };
}

export const JEV_QUESTIONS = LIVEUI_JEV_RULES.questions;

export { JEV_ROUND_5_QUESTIONS };

function canonical(value     )         {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k        ) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export const JEV_QUESTIONS_DIGEST = `sha256:${createHash("sha256").update(canonical(JEV_QUESTIONS)).digest("hex")}`;

export const JEV_ROUND_5_DIGEST = `sha256:${createHash("sha256").update(canonical(JEV_ROUND_5_QUESTIONS)).digest("hex")}`;

export const SURFACE_DECISION_TEMPLATE_DIGEST = `sha256:${createHash("sha256")
  .update(
    JSON.stringify({
      FLOORS,
      KIND_REASON,
      UNKINDED_REASON,
      DECIDED_RENDER_TAIL,
      DECIDED_RENDER_TAIL_UNKINDED,
      DECIDED_RENDER_SKIP_GUIDE,
      DECIDED_CHAT,
      CHAT_SHAPES,
    }),
  )
  .digest("hex")}`;

export const SURFACE_DECISION_V2_TEMPLATE_DIGEST = `sha256:${createHash("sha256")
  .update(
    JSON.stringify({
      DECIDED_V2_FRAMED,
      DECIDED_V2_UNFRAMED,
      DECIDED_V2_TAIL,
      DECIDED_V2_OPEN_SURFACE,
      FRAME_CARDS,
    }),
  )
  .digest("hex")}`;

export const SURFACE_DECISION_V2_CHAT_DIGEST = `sha256:${createHash("sha256")
  .update(JSON.stringify({ DECIDED_V2_CHAT }))
  .digest("hex")}`;

const JUST_NOW_MS = 20_000;
const A_MINUTE_MS = 5 * 60_000;

export function bucketAge(ageMs     ) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "a_while_ago";
  if (ageMs < JUST_NOW_MS) return "just_now";
  if (ageMs < A_MINUTE_MS) return "a_minute_ago";
  return "a_while_ago";
}

export function buildJevState(input     ) {
  const wearerSaid = input && typeof input.wearerSaid === "string" ? input.wearerSaid.trim() : "";
  const last = (input && input.lastSurface) || null;
  const state      = { wearer_said: wearerSaid };
  if (!last || typeof last !== "object") {
    state.last_surface = null;
    return state;
  }
  state.last_surface = {
    kind: typeof last.kind === "string" ? last.kind : null,
    title: typeof last.title === "string" ? last.title : null,
    age: bucketAge(last.ageMs),
    live: Boolean(last.live),
    outcome: typeof last.outcome === "string" ? last.outcome : null,
  };
  return state;
}

function choiceOf(answer     ) {
  return answer && typeof answer.choice === "string" ? answer.choice : null;
}

function confOf(answer     ) {
  return answer && Number.isFinite(answer.confidence) ? answer.confidence : null;
}

export function frameFacts(answers     )                                                           {
  const choice = choiceOf(answers && answers.frame);
  const confidence = confOf(answers && answers.frame);
  if (!choice || confidence === null || !Object.prototype.hasOwnProperty.call(FRAME_CARDS, choice)) {
    return { frame: null, frameConfidence: null };
  }
  return { frame: choice, frameConfidence: confidence };
}

function askedFrame(answers     ) {
  const facts = frameFacts(answers);
  return facts.frame ? facts : {};
}

export function composeSurfaceDecision(answers     , options      = {}) {

  const overrides = Object.entries((options && options.floors) || {}).filter(([, v]) => Number.isFinite(v));
  const floors = { ...FLOORS, ...Object.fromEntries(overrides) };
  if (!answers || typeof answers !== "object") return null;

  const shapeChoice = choiceOf(answers.reply_shape);
  const shapeConf = confOf(answers.reply_shape);
  if (!shapeChoice || shapeConf === null) return null;
  if (shapeConf < (shapeChoice === RENDER_SHAPE ? floors.render : floors.chat)) return null;

  if (shapeChoice === RENDER_SHAPE) {
    const kindChoice = choiceOf(answers.kind);
    const kindConf = confOf(answers.kind);
    const kindOverFloor = kindChoice && kindConf !== null && kindConf >= floors.kind ? kindChoice : null;

    if (kindOverFloor && !Object.prototype.hasOwnProperty.call(KIND_REASON, kindOverFloor)) return null;
    const kind = kindOverFloor;

    const slotChoice = choiceOf(answers.graphic_slot);
    const slotConf = confOf(answers.graphic_slot);
    const slot =
      kind === "text_surface" && slotChoice && slotChoice !== "none" && slotConf !== null && slotConf >= floors.slot
        ? slotChoice
        : null;

    const subject = kind ? `${kind}${slot ? `, template graphic, slot ${slot}` : ""}` : null;
    const reason = kind ? KIND_REASON[kind                            ] : UNKINDED_REASON;
    const body = subject
      ? `This turn renders a ${subject}. ${DECIDED_RENDER_TAIL}${slot ? "" : ` ${DECIDED_RENDER_SKIP_GUIDE}`}`
      : `This turn renders a surface. ${DECIDED_RENDER_TAIL_UNKINDED}`;
    return {
      block: wrapBlock(body),
      oneLine: wrapOneLine(body),
      decision: { shape: RENDER_SHAPE, kind, slot, confidence: shapeConf, reason, line: "render", ...askedFrame(answers) },
    };
  }

  if (CHAT_SHAPES.includes(shapeChoice)) {
    return {
      block: wrapBlock(DECIDED_CHAT),
      oneLine: wrapOneLine(DECIDED_CHAT),
      decision: {
        shape: shapeChoice,
        kind: null,
        slot: null,
        confidence: shapeConf,
        reason: null,
        line: "chat",
        ...askedFrame(answers),
      },
    };
  }

  return null;
}

function wrapBlock(body     ) {
  return `<${TAG}>\n${body}\n</${TAG}>`;
}

function wrapOneLine(body     ) {
  return `<${TAG}> ${body} ${SURFACE_DECISION_SCOPE} </${TAG}>`;
}
