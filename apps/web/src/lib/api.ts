export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `API returned ${response.status}`;
    throw new Error(errorMessage);
  }

  return body as T;
}
