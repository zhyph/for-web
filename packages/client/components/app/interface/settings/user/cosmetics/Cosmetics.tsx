import { For, JSX, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import {
  BUILTIN,
  CosmeticItem,
  CosmeticKind,
  NameEffect,
  NameFont,
  ProfileTheme,
  UserStyle,
  cacheMemberStyle,
  cacheUserStyle,
  cosmeticItems,
  itemUrl,
  loadItems,
  memberStyle,
  serverStyle,
  userStyle,
} from "@revolt/client/cosmetics";
import { forkApi, uploadFile } from "@revolt/client/forkApi";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Avatar,
  Button,
  CategoryButton,
  CategorySelectOption,
  Column,
  Row,
  Text,
  TextField,
} from "@revolt/ui";
import { fontFamily } from "@revolt/ui/components/features/cosmetics/Cosmetics";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

const FONT_NAMES: NameFont[] = [
  "Default",
  "Serif",
  "Mono",
  "Rounded",
  "Handwritten",
  "Pixel",
];

/**
 * Nitro-style cosmetics (fork, see NITRO.md): profile theme, display name style, avatar decoration,
 * profile effect, server tag and per-server profiles. Free for everyone.
 */
export function Cosmetics() {
  const { t } = useLingui();
  const client = useClient();
  const err = useError();
  const me = () => client().user!;

  // editable copy of our style; reset whenever the cached one arrives or changes
  const [draft, setDraft] = createSignal<Omit<UserStyle, "_id">>({});
  createEffect(
    on(
      () => userStyle(me().id),
      (style) => style !== undefined && setDraft({ ...(style ?? {}) }),
    ),
  );
  const patch = (next: Partial<UserStyle>) =>
    setDraft((d) => ({ ...d, ...next }));
  const name = () =>
    draft().name ?? {
      font: "Default" as NameFont,
      effect: "None" as NameEffect,
    };

  const [saved, setSaved] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  async function save() {
    setError(undefined);
    try {
      const style = await forkApi<UserStyle>(
        client(),
        "PUT",
        "/cosmetics/users/@me",
        draft(),
      );
      cacheUserStyle(style);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e);
    }
  }

  // servers whose tag we could wear
  const taggable = () =>
    client()
      .servers.toList()
      .filter((server) => serverStyle(server.id)?.tag);

  return (
    <Column gap="lg">
      <Text class="label">
        <Trans>
          Everything here is free for everyone on this server. Changes show
          after you save.
        </Trans>
      </Text>

      {/* preview */}
      <div
        class={css({
          position: "relative",
          padding: "var(--gap-lg)",
          borderRadius: "var(--borderRadius-xl)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: "var(--gap-lg)",
        })}
        style={{
          background: draft().theme
            ? `linear-gradient(180deg, ${draft().theme!.primary}, ${draft().theme!.accent})`
            : "var(--md-sys-color-surface-container-low)",
        }}
      >
        <Show when={itemUrl(draft().effect)}>
          <div
            class="zc-effect"
            style={{ "background-image": `url("${itemUrl(draft().effect)}")` }}
          />
        </Show>
        <span class="zc-deco">
          <Avatar src={me().animatedAvatarURL} size={64} />
          <Show when={itemUrl(draft().decoration)}>
            <img class="zc-deco-img" src={itemUrl(draft().decoration)} alt="" />
          </Show>
        </span>
        <PreviewName style={draft()} name={me().displayName ?? me().username} />
      </div>

      {/* profile theme */}
      <Column>
        <Text class="title">
          <Trans>Profile Theme</Trans>
        </Text>
        <Row align>
          <Button
            variant={draft().theme ? "tonal" : "filled"}
            onPress={() => patch({ theme: undefined })}
          >
            <Trans>Default</Trans>
          </Button>
          <ColourInput
            label={t`Top`}
            value={draft().theme?.primary ?? "#1e1b4b"}
            onChange={(primary) =>
              patch({
                theme: {
                  accent: draft().theme?.accent ?? "#be185d",
                  primary,
                } satisfies ProfileTheme,
              })
            }
          />
          <ColourInput
            label={t`Bottom`}
            value={draft().theme?.accent ?? "#be185d"}
            onChange={(accent) =>
              patch({
                theme: {
                  primary: draft().theme?.primary ?? "#1e1b4b",
                  accent,
                },
              })
            }
          />
        </Row>
      </Column>

      {/* display name style */}
      <Column>
        <Text class="title">
          <Trans>Display Name Style</Trans>
        </Text>
        <CategoryButton.Group>
          <CategoryButton.Select
            icon={<Symbol>font_download</Symbol>}
            title={<Trans>Font</Trans>}
            options={
              Object.fromEntries(
                FONT_NAMES.map((font) => [
                  font,
                  {
                    title: (
                      <span style={{ "font-family": fontFamily(font) }}>
                        {font}
                      </span>
                    ),
                  },
                ]),
              ) as Record<NameFont, CategorySelectOption>
            }
            value={name().font}
            onUpdate={(font) =>
              patch({ name: { ...name(), font: font as NameFont } })
            }
          />
          <CategoryButton.Select
            icon={<Symbol>auto_awesome</Symbol>}
            title={<Trans>Effect</Trans>}
            options={{
              None: { title: <Trans>None</Trans> },
              Glow: { title: <Trans>Glow</Trans> },
              Shimmer: { title: <Trans>Shimmer</Trans> },
            }}
            value={name().effect}
            onUpdate={(effect) =>
              patch({ name: { ...name(), effect: effect as NameEffect } })
            }
          />
        </CategoryButton.Group>
        <Row align>
          <Button
            variant={name().colour ? "tonal" : "filled"}
            onPress={() => patch({ name: { ...name(), colour: undefined } })}
          >
            <Trans>No colour</Trans>
          </Button>
          <ColourInput
            label={t`Colour`}
            value={gradientStops(name().colour)[0]}
            onChange={(c) =>
              patch({
                name: {
                  ...name(),
                  colour: gradientStops(name().colour)[1]
                    ? `linear-gradient(90deg, ${c}, ${gradientStops(name().colour)[1]})`
                    : c,
                },
              })
            }
          />
          <ColourInput
            label={t`Gradient to`}
            value={gradientStops(name().colour)[1] ?? "#38bdf8"}
            onChange={(c) =>
              patch({
                name: {
                  ...name(),
                  colour: `linear-gradient(90deg, ${gradientStops(name().colour)[0]}, ${c})`,
                },
              })
            }
          />
        </Row>
        <Text class="label">
          <Trans>
            A role colour in a server takes priority over this colour.
          </Trans>
        </Text>
      </Column>

      <ItemPicker
        kind="Decoration"
        title={<Trans>Avatar Decoration</Trans>}
        value={draft().decoration}
        onPick={(decoration) => patch({ decoration })}
      />
      <ItemPicker
        kind="Effect"
        title={<Trans>Profile Effect</Trans>}
        value={draft().effect}
        onPick={(effect) => patch({ effect })}
      />

      {/* server tag */}
      <Column>
        <Text class="title">
          <Trans>Server Tag</Trans>
        </Text>
        <CategoryButton.Group>
          <CategoryButton.Select
            icon={<Symbol>sell</Symbol>}
            title={<Trans>Show next to my name</Trans>}
            options={Object.fromEntries([
              ["none", { title: <Trans>None</Trans> }],
              ...taggable().map((server) => [
                server.id,
                {
                  title: `${serverStyle(server.id)!.tag} · ${server.name}`,
                },
              ]),
            ])}
            value={draft().tag_server ?? "none"}
            onUpdate={(id) =>
              patch({ tag_server: id === "none" ? undefined : id })
            }
          />
        </CategoryButton.Group>
      </Column>

      <Row align>
        <Button onPress={save}>
          <Trans>Save</Trans>
        </Button>
        <Show when={saved()}>
          <Text class="label">
            <Trans>Saved</Trans>
          </Text>
        </Show>
        <Show when={error()}>
          <Text class="label">{err(error() as Parameters<typeof err>[0])}</Text>
        </Show>
      </Row>

      <ServerProfiles />
      <Show when={me().privileged}>
        <CatalogAdmin />
      </Show>
    </Column>
  );
}

/** "#aaa" → ["#aaa"]; "linear-gradient(90deg, #a, #b)" → ["#a", "#b"] */
function gradientStops(colour?: string): [string, string?] {
  if (!colour) return ["#f472b6"];
  const stops = colour.match(/#[0-9a-fA-F]{3,8}/g);
  return colour.includes("gradient") && stops?.length
    ? [stops[0], stops[1]]
    : [colour.startsWith("#") ? colour : "#f472b6"];
}

function PreviewName(props: { style: Omit<UserStyle, "_id">; name: string }) {
  // StyledName reads from the cache, so preview the draft by rendering with the same classes
  const n = () => props.style.name;
  const shimmer = () => n()?.effect === "Shimmer";
  return (
    <span
      class={`zc-name ${shimmer() ? "zc-shimmer" : ""} ${n()?.effect === "Glow" ? "zc-glow" : ""}`}
      style={{
        "font-size": "1.4em",
        "font-weight": 600,
        "font-family": fontFamily(n()?.font),
        ...(shimmer() || n()?.colour?.includes("gradient")
          ? {
              "background-image": n()?.colour?.includes("gradient")
                ? n()!.colour
                : `linear-gradient(90deg, ${n()?.colour ?? "#ffffff"}, color-mix(in srgb, ${n()?.colour ?? "#ffffff"} 45%, white), ${n()?.colour ?? "#ffffff"})`,
              "-webkit-background-clip": "text",
              "background-clip": "text",
              "-webkit-text-fill-color": "transparent",
            }
          : { color: n()?.colour }),
      }}
    >
      {props.name}
    </span>
  );
}

function ColourInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      class={css({
        display: "flex",
        alignItems: "center",
        gap: "var(--gap-sm)",
      })}
    >
      <input
        type="color"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
      />
      <Text class="label">{props.label}</Text>
    </label>
  );
}

function ItemPicker(props: {
  kind: CosmeticKind;
  title: JSX.Element;
  value?: string;
  onPick: (id?: string) => void;
}) {
  const options = () => [
    ...BUILTIN[props.kind].map((b) => ({
      id: `builtin:${b.slug}`,
      name: b.name,
    })),
    ...cosmeticItems()
      .filter((i: CosmeticItem) => i.kind === props.kind)
      .map((i) => ({ id: i._id, name: i.name })),
  ];
  const tile = css({
    width: "84px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--gap-xs)",
    padding: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-md)",
    border: "2px solid transparent",
    background: "var(--md-sys-color-surface-container-low)",
    color: "var(--md-sys-color-on-surface)",
    cursor: "pointer",
    fontSize: "12px",
  });
  return (
    <Column>
      <Text class="title">{props.title}</Text>
      <div
        class={css({ display: "flex", flexWrap: "wrap", gap: "var(--gap-sm)" })}
      >
        <button
          class={tile}
          style={{
            "border-color": props.value
              ? "transparent"
              : "var(--md-sys-color-primary)",
          }}
          onClick={() => props.onPick(undefined)}
        >
          <Symbol>block</Symbol>
          <Trans>None</Trans>
        </button>
        <For each={options()}>
          {(option) => (
            <button
              class={tile}
              style={{
                "border-color":
                  props.value === option.id
                    ? "var(--md-sys-color-primary)"
                    : "transparent",
              }}
              onClick={() => props.onPick(option.id)}
              title={option.name}
            >
              <span
                style={{
                  width: "56px",
                  height: "56px",
                  position: "relative",
                  "border-radius": props.kind === "Effect" ? "8px" : "50%",
                  overflow: "hidden",
                  background: "var(--md-sys-color-surface-container-highest)",
                }}
              >
                <img
                  src={itemUrl(option.id)}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    "object-fit": "cover",
                  }}
                />
              </span>
              {option.name}
            </button>
          )}
        </For>
      </div>
    </Column>
  );
}

/** Per-server banner and bio */
function ServerProfiles() {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const err = useError();
  const servers = () => client().servers.toList();
  const [server, setServer] = createSignal(servers()[0]?.id);
  const current = () => memberStyle(server(), client().user!.id);

  const [bio, setBio] = createSignal("");
  createEffect(on(current, (style) => setBio(style?.bio ?? "")));
  const [banner, setBanner] = createSignal<File | null>();
  const [status, setStatus] = createSignal<unknown>();
  let fileInput!: HTMLInputElement;

  async function save() {
    setStatus(undefined);
    try {
      const picked = banner();
      const style = await forkApi(
        client(),
        "PUT",
        `/cosmetics/servers/${server()}/members/@me`,
        {
          bio: bio().trim() || undefined,
          ...(picked
            ? {
                banner: await uploadFile(
                  client(),
                  instance.mediaUrl,
                  "backgrounds",
                  picked,
                ),
              }
            : picked === null
              ? {}
              : { keep_banner: true }),
        },
      );
      cacheMemberStyle(style as Parameters<typeof cacheMemberStyle>[0]);
      setBanner(undefined);
      fileInput.value = "";
      setStatus(t`Saved`);
    } catch (e) {
      setStatus(e);
    }
  }

  return (
    <Show when={servers().length}>
      <Column>
        <Text class="title">
          <Trans>Per-server Profile</Trans>
        </Text>
        <CategoryButton.Group>
          <CategoryButton.Select
            icon={<Symbol>dns</Symbol>}
            title={<Trans>Server</Trans>}
            options={Object.fromEntries(
              servers().map((s) => [s.id, { title: s.name }]),
            )}
            value={server()!}
            onUpdate={setServer}
          />
        </CategoryButton.Group>
        <TextField
          label={t`Server bio (shown on your profile in this server)`}
          value={bio()}
          maxlength={190}
          onInput={(e) => setBio(e.currentTarget.value)}
        />
        <Row align>
          <Button variant="tonal" onPress={() => fileInput.click()}>
            <Symbol>image</Symbol>
            <Show
              when={banner()}
              fallback={
                current()?.banner && banner() !== null ? (
                  <Trans>Replace server banner</Trans>
                ) : (
                  <Trans>Choose server banner</Trans>
                )
              }
            >
              {banner()!.name}
            </Show>
          </Button>
          <Show when={current()?.banner && banner() !== null}>
            <Button variant="text" onPress={() => setBanner(null)}>
              <Trans>Remove banner</Trans>
            </Button>
          </Show>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setBanner(e.currentTarget.files?.[0])}
          />
        </Row>
        <Row align>
          <Button onPress={save}>
            <Trans>Save server profile</Trans>
          </Button>
          <Show when={status()}>
            <Text class="label">
              {typeof status() === "string"
                ? (status() as string)
                : err(status() as Parameters<typeof err>[0])}
            </Text>
          </Show>
        </Row>
      </Column>
    </Show>
  );
}

/** Instance admins add uploaded decorations/effects everyone can pick */
function CatalogAdmin() {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const err = useError();
  const [kind, setKind] = createSignal<CosmeticKind>("Decoration");
  const [file, setFile] = createSignal<File>();
  const [name, setName] = createSignal("");
  const [status, setStatus] = createSignal<unknown>();
  let fileInput!: HTMLInputElement;

  async function add() {
    setStatus(undefined);
    try {
      const id = await uploadFile(
        client(),
        instance.mediaUrl,
        "emojis",
        file()!,
      );
      await forkApi(client(), "POST", "/cosmetics/items", {
        file_id: id,
        kind: kind(),
        name: name().trim(),
      });
      await loadItems();
      setFile(undefined);
      setName("");
      fileInput.value = "";
      setStatus(t`Added`);
    } catch (e) {
      setStatus(e);
    }
  }

  async function remove(id: string) {
    await forkApi(client(), "DELETE", `/cosmetics/items/${id}`)
      .then(loadItems)
      .catch(setStatus);
  }

  return (
    <Column>
      <Text class="title">
        <Trans>Catalog (instance admin)</Trans>
      </Text>
      <Text class="label">
        <Trans>
          Animated WebP, APNG or GIF up to 500 KB. Decorations are drawn 136%
          the size of the avatar, centred; effects cover the profile card.
        </Trans>
      </Text>
      <Row align>
        <CategoryButton.Group>
          <CategoryButton.Select
            icon={<Symbol>category</Symbol>}
            title={<Trans>Kind</Trans>}
            options={{
              Decoration: { title: <Trans>Avatar decoration</Trans> },
              Effect: { title: <Trans>Profile effect</Trans> },
            }}
            value={kind()}
            onUpdate={(k) => setKind(k as CosmeticKind)}
          />
        </CategoryButton.Group>
      </Row>
      <Row align>
        <Button variant="tonal" onPress={() => fileInput.click()}>
          <Symbol>upload_file</Symbol>
          <Show when={file()} fallback={<Trans>Choose image</Trans>}>
            {file()!.name}
          </Show>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => setFile(e.currentTarget.files?.[0])}
        />
        <TextField
          label={t`Name`}
          value={name()}
          maxlength={32}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <Button isDisabled={!file() || !name().trim()} onPress={add}>
          <Trans>Add</Trans>
        </Button>
      </Row>
      <For each={cosmeticItems()}>
        {(item) => (
          <Row align>
            <img src={itemUrl(item._id)} alt="" width={32} height={32} />
            <Text class="label">
              {item.name} · {item.kind}
            </Text>
            <Button variant="text" onPress={() => remove(item._id)}>
              <Trans>Delete</Trans>
            </Button>
          </Row>
        )}
      </For>
      <Show when={status()}>
        <Text class="label">
          {typeof status() === "string"
            ? (status() as string)
            : err(status() as Parameters<typeof err>[0])}
        </Text>
      </Show>
    </Column>
  );
}
