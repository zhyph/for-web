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
.zc-named { display: inline-flex; align-items: center; gap: 6px; vertical-align: bottom; max-width: 100%; }
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
  display: inline-flex; align-items: center; gap: 2px; padding: 0 5px; flex-shrink: 0;
  border-radius: 4px; font-size: 0.72em; font-weight: 700; line-height: 1.5;
  background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface);
  --emoji-size: 1.1em;
}
.zc-deco { position: relative; display: inline-block; line-height: 0; }
.zc-deco > img.zc-deco-img {
  position: absolute; inset: -18%; width: 136%; height: 136%; max-width: none; max-height: none;
  pointer-events: none; z-index: 1;
}
/* effects are drawn for a 340x400 card: keep that scale and tile sideways on wider cards so particles never grow */
.zc-effect { position: absolute; inset: 0; pointer-events: none; z-index: 2; border-radius: inherit;
  background-size: 340px 400px; background-repeat: repeat-x; background-position: center top; }
input.zc-colour {
  width: 28px; height: 28px; padding: 0; border: 2px solid var(--md-sys-color-outline-variant);
  border-radius: 50%; background: none; cursor: pointer; transition: opacity .15s;
}
input.zc-colour::-webkit-color-swatch-wrapper { padding: 0; }
input.zc-colour::-webkit-color-swatch { border: none; border-radius: 50%; }
input.zc-colour::-moz-color-swatch { border: none; border-radius: 50%; }
input.zc-colour.zc-off { opacity: .35; }
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

/** Bundled OFL fonts (served from our origin), loaded the first time a name uses them */
const FONT_FILES: Partial<Record<NameFont, () => Promise<unknown>>> = {
  Serif: () => import("@fontsource/bitter/600.css"),
  Mono: () => import("@fontsource/jetbrains-mono/600.css"),
  Rounded: () => import("@fontsource/lexend/600.css"),
  Handwritten: () => import("@fontsource/comic-neue/700.css"),
  Pixel: () => import("@fontsource/press-start-2p/400.css"),
};
const loaded = new Set<NameFont>();

const FAMILIES: Record<NameFont, string | undefined> = {
  Default: undefined,
  Serif: '"Bitter", Georgia, serif',
  Mono: '"JetBrains Mono", monospace',
  Rounded: '"Lexend", system-ui',
  Handwritten: '"Comic Neue", cursive',
  Pixel: '"Press Start 2P", monospace',
};

/** CSS font-family for a name font, loading its file on first use */
export function fontFamily(font: NameFont = "Default") {
  if (!loaded.has(font)) {
    loaded.add(font);
    void FONT_FILES[font]?.();
  }
  return FAMILIES[font];
}

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
    <span class="zc-named">
      <span
        class={`zc-name ${animated() ?? ""} ${style()?.effect === "Glow" ? "zc-glow" : ""}`}
        style={{
          "font-family": fontFamily(style()?.font),
          // the pixel font is wide; a smaller size keeps names on one line
          "font-size": style()?.font === "Pixel" ? "0.7em" : undefined,
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
    </span>
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
