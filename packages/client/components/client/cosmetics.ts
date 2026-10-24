import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import { API, Client, File } from "stoat.js";

import { forkApi } from "./forkApi";

/**
 * Cosmetics (Nitro parity fork, see NITRO.md). They live behind the fork's `/cosmetics` routes, so this module
 * keeps a reactive cache filled on demand; CosmeticsSync gives it the client and follows CosmeticsUpdate events.
 */

export type NameFont =
  | "Default"
  | "Serif"
  | "Mono"
  | "Rounded"
  | "Handwritten"
  | "Pixel";
export type NameEffect = "None" | "Glow" | "Shimmer";
export type NameStyle = { font: NameFont; colour?: string; effect: NameEffect };
export type ProfileTheme = { primary: string; accent: string };
export type UserStyle = {
  _id: string;
  theme?: ProfileTheme;
  name?: NameStyle;
  decoration?: string;
  effect?: string;
  tag_server?: string;
};
export type RoleStyle = "GradientAnimated" | "Holographic";
export type ServerStyle = {
  _id: string;
  tag?: string;
  tag_emoji?: string;
  invite_background?: API.File;
  vanity?: string;
  role_styles?: Record<string, RoleStyle>;
};
export type MemberStyle = {
  server: string;
  user: string;
  banner?: API.File;
  bio?: string;
};
export type CosmeticKind = "Decoration" | "Effect";
export type CosmeticItem = {
  _id: string;
  kind: CosmeticKind;
  name: string;
  file: API.File;
};

/** Designs shipped with the client (public/cosmetics), referenced as `builtin:<slug>` */
export const BUILTIN: Record<
  CosmeticKind,
  { slug: string; name: string; icon?: string }[]
> = {
  Decoration: [
    { slug: "aurora", name: "Aurora" },
    { slug: "neon", name: "Neon Pulse" },
    { slug: "orbit", name: "Orbit" },
    { slug: "ember", name: "Ember" },
    { slug: "glitch", name: "Glitch" },
    { slug: "prism", name: "Prism" },
    { slug: "frost", name: "Frost" },
    { slug: "halo", name: "Halo" },
  ],
  Effect: [
    { slug: "starfield", name: "Starfield", icon: "star" },
    { slug: "sakura", name: "Sakura", icon: "local_florist" },
    { slug: "rays", name: "Light Rays", icon: "wb_sunny" },
    { slug: "snow", name: "Snowfall", icon: "ac_unit" },
    { slug: "bubbles", name: "Bubbles", icon: "bubble_chart" },
  ],
};

let client: Client | undefined;

const [users, setUsers] = createStore<Record<string, UserStyle | null>>({});
const [servers, setServers] = createStore<Record<string, ServerStyle | null>>(
  {},
);
const [members, setMembers] = createStore<Record<string, MemberStyle | null>>(
  {},
);
const [items, setItems] = createSignal<CosmeticItem[]>([]);

const requestedUsers = new Set<string>();
const requestedServers = new Set<string>();
const requestedMembers = new Set<string>();
const pendingUsers: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flushUsers() {
  flushTimer = undefined;
  const ids = pendingUsers.splice(0);
  if (!client) return;
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    forkApi<UserStyle[]>(client, "POST", "/cosmetics/users", { ids: batch })
      .then((styles) => {
        const found = new Map(styles.map((s) => [s._id, s]));
        for (const id of batch) setUsers(id, found.get(id) ?? null);
      })
      .catch(() => batch.forEach((id) => requestedUsers.delete(id)));
  }
}

function loadServer(id: string) {
  if (!client) return;
  forkApi<ServerStyle>(client, "GET", `/cosmetics/servers/${id}`)
    .then((style) => setServers(id, style))
    .catch(() => requestedServers.delete(id));
}

function loadMember(server: string, user: string) {
  if (!client) return;
  forkApi<MemberStyle>(
    client,
    "GET",
    `/cosmetics/servers/${server}/members/${user}`,
  )
    .then((style) => setMembers(`${server}:${user}`, style))
    .catch(() => requestedMembers.delete(`${server}:${user}`));
}

/** A user's cosmetics (undefined while loading, null if none) */
export function userStyle(id?: string) {
  if (!id) return;
  if (!requestedUsers.has(id) && client) {
    requestedUsers.add(id);
    pendingUsers.push(id);
    flushTimer ??= setTimeout(flushUsers, 30);
  }
  return users[id];
}

export function serverStyle(id?: string) {
  if (!id) return;
  if (!requestedServers.has(id) && client) {
    requestedServers.add(id);
    loadServer(id);
  }
  return servers[id];
}

export function memberStyle(server?: string, user?: string) {
  if (!server || !user) return;
  const key = `${server}:${user}`;
  if (!requestedMembers.has(key) && client) {
    requestedMembers.add(key);
    loadMember(server, user);
  }
  return members[key];
}

export const cosmeticItems = items;

/** URL of a decoration/effect, built-in or uploaded */
export function itemUrl(id?: string) {
  if (!id) return;
  if (id.startsWith("builtin:")) {
    const kind = BUILTIN.Decoration.some((d) => `builtin:${d.slug}` === id)
      ? "decorations"
      : "effects";
    return `${import.meta.env.BASE_URL}cosmetics/${kind}/${id.slice(8)}.svg`;
  }
  const item = items().find((i) => i._id === id);
  return item && client ? new File(client, item.file).originalUrl : undefined;
}

export function fileUrl(file?: API.File) {
  return file && client ? new File(client, file).originalUrl : undefined;
}

/** Put a fresh copy into the cache (after saving) */
export const cacheUserStyle = (style: UserStyle) => setUsers(style._id, style);
export const cacheServerStyle = (style: ServerStyle) =>
  setServers(style._id, style);
export const cacheMemberStyle = (style: MemberStyle) =>
  setMembers(`${style.server}:${style.user}`, style);

export async function loadItems() {
  if (client) setItems(await forkApi(client, "GET", "/cosmetics/items"));
}

/** Called by CosmeticsSync */
export function attachCosmetics(next: Client) {
  client = next;
  loadItems().catch(() => {});
}

/** CosmeticsUpdate: refetch what changed, if we've seen it */
export function onCosmeticsUpdate(kind: string, id: string) {
  if (kind === "user" && requestedUsers.has(id)) {
    pendingUsers.push(id);
    flushTimer ??= setTimeout(flushUsers, 30);
  } else if (kind === "server" && requestedServers.has(id)) {
    loadServer(id);
  } else if (kind === "member" && requestedMembers.has(id)) {
    const [server, user] = id.split(":");
    loadMember(server, user);
  }
}
