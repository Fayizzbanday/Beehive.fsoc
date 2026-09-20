import useSWR from "swr";
import type { ApiResult, User } from "../../../../packages/shared/src/index";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const base = import.meta.env.VITE_API_URL ?? "";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  let payload: ApiResult<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "The API is unavailable. Start the BeeHive Worker and try again.",
    );
  }
  if (!payload.success)
    throw new ApiError(response.status, payload.error.message);
  return payload.data;
}
export const apiUrl = (path: string) => `${base}/api${path}`;
export const post = <T>(path: string, data: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export async function downloadDocument(id: string, filename: string) {
  const response = await fetch(
    `${base}/api/documents/${encodeURIComponent(id)}`,
    {
      credentials: "include",
    },
  );
  if (!response.ok)
    throw new ApiError(
      response.status,
      "Document download failed. Please try again.",
    );
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const useApi = <T>(path: string | null, refreshInterval = 0) =>
  useSWR<T>(path, api, {
    refreshInterval,
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  });
export const useUser = () => useApi<User>("/auth/me");
export const shortHash = (hash?: string | null) =>
  hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : "Awaiting proof";
