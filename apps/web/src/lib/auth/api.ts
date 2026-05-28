import { api } from "../api/client";
import type { AuthHCenter, AuthUser } from "./store";

export interface LoginResponse {
  user: AuthUser;
  hcenter: AuthHCenter;
  tokens: {
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
    anonymous: true,
  });
}

export function fetchMe(): Promise<{ user: AuthUser; hcenter: AuthHCenter }> {
  return api<{ user: AuthUser; hcenter: AuthHCenter }>("/auth/me");
}
