const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
  token?: string;
}

export async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { requiresAuth = true, token, headers: customHeaders, ...restOptions } = options;
  const headers = new Headers(customHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An error occurred while fetching the data.";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}
