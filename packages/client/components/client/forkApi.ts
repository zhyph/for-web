import type { Client } from "stoat.js";

/**
 * Call an API route of our Nitro-parity backend fork (see NITRO.md). These routes and fields aren't in the
 * SDK's typed API, so they go through fetch with the client's session header. Errors throw the API's error
 * body ({ type, ... }), which useError() can describe.
 */
export async function forkApi<T>(
  client: Client,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const [key, value] = client.authenticationHeader;
  const res = await fetch(`${client.options.baseURL}${path}`, {
    method,
    headers: {
      [key]: value,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw await res
      .json()
      .catch(() => ({ type: "HttpError", status: res.status }));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
