"use client";

import { useAuth } from "@clerk/nextjs";
import { fetchApi } from "@/lib/api";

export function useApi() {
  const { getToken } = useAuth();

  async function apiFetch<T>(endpoint: string, options: Parameters<typeof fetchApi>[1] = {}): Promise<T> {
    const token = await getToken();
    return fetchApi<T>(endpoint, { ...options, token: token || undefined });
  }

  return { apiFetch, getToken };
}
