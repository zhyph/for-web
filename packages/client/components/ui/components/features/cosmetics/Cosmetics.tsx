import { JSX, Show } from "solid-js";

import {
  NameFont,
  itemUrl,
  serverStyle,
  userStyle,
} from "@revolt/client/cosmetics";
import { Emoji } from "@revolt/markdown";

/**
 * Cosmetics rendering (Nitro parity fork, see NITRO.md). Plain CSS injected once: Panda only extracts keyframes
 * from its config, and these are fork-only.
 */
const STYLE = `
@keyframes zc-shimmer { to { background-position: -200% 0; } }
@keyframes zc-glow { 50% { text-shadow: 0 0 6px currentColor, 0 0 12px currentColor; } }
.zc-name { display: inline-block; }
.zc-shimmer, .zc-role-gradient, .zc-role-holo {
  background-size: 200% 100% !important;
  -webkit-background-clip: text !important; background-clip: text !important;
  -webkit-text-fill-color: transparent;
  animation: zc-shimmer 3s linear infinite;
}
.zc-glow { animation: zc-glow 2.4s ease-in-out infinite; text-shadow: 0 0 3px currentColor; }
.zc-role-holo { background-image: linear-gradient(110deg, #ff9ad5, #9ad8ff, #fff3a8, #b69aff, #ff9ad5) !important; }
.zc-tag {
  display: inline-flex; align-items: center; gap: 2px; margin-inline-start: 6px; padding: 0 5px;
  border-radius: 4px; font-size: 0.72em; font-weight: 700; line-height: 1.5; vertical-align: middle;
  background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface);
  --emoji-size: 1.1em;
}
.zc-deco { position: relative; display: inline-block; line-height: 0; }
.zc-deco > img.zc-deco-img {
  position: absolute; inset: -18%; width: 136%; height: 136%; pointer-events: none; z-index: 1;
}
.zc-effect { position: absolute; inset: 0; pointer-events: none; z-index: 2; border-radius: inherit;
  background-size: cover; background-position: center; }
@media (prefers-reduced-motion: reduce) {
  .zc-shimmer, .zc-role-gradient, .zc-role-holo, .zc-glow { animation: none; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("zc-css")) {
  const el = document.createElement("style");
  el.id = "zc-css";
  el.textContent = STYLE;
  document.head.appendChild(el);
}

/** System font stacks only: no third-party font requests */
export const FONTS: Record<NameFont, string | undefined> = {
  Default: undefined,
  Serif: 'Georgia, "Times New Roman", serif',
  Mono: 'ui-monospace, "JetBrains Mono", "Cascadia Code", monospace',
  Rounded: 'ui-rounded, "SF Pro Rounded", "Varela Round", "Nunito", system-ui',
  Handwritten: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
  Pixel: '"Press Start 2P", "VT323", "Courier New", monospace',
};

/** Solid colour → a gradient of itself, so role "gradient" styles work with plain colours too */
const asGradient = (colour: string) =>
  colour.includes("gradient")
    ? colour
    : `linear-gradient(90deg, ${colour}, color-mix(in srgb, ${colour} 45%, white), ${colour})`;

/**
 * A display name with the author's name style, the role style of their colour role and their server tag.
 * Role colour wins over the personal colour (as with role colours today); font and effect always apply.
 */
export function StyledName(props: {
  name?: string;
  userId?: string;
  serverId?: string;
  roleColour?: string | null;
  roleId?: string;
  noTag?: boolean;
}) {
  const style = () => userStyle(props.userId)?.name;
  const roleStyle = () =>
    props.roleId
      ? serverStyle(props.serverId)?.role_styles?.[props.roleId]
      : undefined;
  const colour = () => props.roleColour ?? style()?.colour;
  const animated = () =>
    roleStyle() === "Holographic"
      ? "zc-role-holo"
      : roleStyle() === "GradientAnimated"
        ? "zc-role-gradient"
        : style()?.effect === "Shimmer"
          ? "zc-shimmer"
          : undefined;

  return (
    <>
      <span
        class={`zc-name ${animated() ?? ""} ${style()?.effect === "Glow" ? "zc-glow" : ""}`}
        style={{
          "font-family": FONTS[style()?.font ?? "Default"],
          ...(animated()
            ? {
                "background-image":
                  roleStyle() === "Holographic"
                    ? undefined
                    : asGradient(colour() ?? "var(--md-sys-color-primary)"),
              }
            : colour()?.includes("gradient")
              ? {
                  background: colour(),
                  "-webkit-background-clip": "text",
                  "background-clip": "text",
                  "-webkit-text-fill-color": "transparent",
                }
              : { color: colour() ?? undefined }),
        }}
      >
        {props.name}
      </span>
      <Show when={!props.noTag}>
        <ServerTag userId={props.userId} />
      </Show>
    </>
  );
}

/** The tag of the server a user chose to wear */
export function ServerTag(props: { userId?: string }) {
  const server = () => serverStyle(userStyle(props.userId)?.tag_server);
  return (
    <Show when={server()?.tag}>
      <span class="zc-tag">
        <Show when={server()!.tag_emoji}>
          <Emoji emoji={server()!.tag_emoji!} />
        </Show>
        {server()!.tag}
      </span>
    </Show>
  );
}

/** Wraps an avatar and draws the user's decoration around it */
export function Decorated(props: { userId?: string; children: JSX.Element }) {
  const url = () => itemUrl(userStyle(props.userId)?.decoration);
  return (
    <span class="zc-deco">
      {props.children}
      <Show when={url()}>
        <img class="zc-deco-img" src={url()} alt="" draggable={false} />
      </Show>
    </span>
  );
}

/** Profile effect overlay; place inside a positioned container */
export function ProfileEffect(props: { userId?: string }) {
  const url = () => itemUrl(userStyle(props.userId)?.effect);
  return (
    <Show when={url()}>
      <div
        class="zc-effect"
        style={{ "background-image": `url("${url()}")` }}
      />
    </Show>
  );
}

/** Profile theme: the card fades from the primary to the accent colour */
export function profileTheme(userId?: string): JSX.CSSProperties {
  const theme = userStyle(userId)?.theme;
  return theme
    ? {
        background: `linear-gradient(180deg, ${theme.primary}, ${theme.accent})`,
        position: "relative",
      }
    : { position: "relative" };
}
