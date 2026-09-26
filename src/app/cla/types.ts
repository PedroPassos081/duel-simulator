import type { ClanRole } from "@/lib/clans/roles";

export interface AvatarData {
  image: string | null;
  name: string | null;
  frameUrl: string | null;
}

export interface NameData {
  name: string | null;
  effect: string | null;
}

export interface ClanMemberView {
  userId: string;
  role: ClanRole;
  joinedAt: string;
  avatar: AvatarData;
  playerName: NameData;
  contribution: { gold: number; cash: number };
}

export interface ClanRequestView {
  id: string;
  type: string;
  summary: string;
  status: string;
  autoExecute: boolean;
  requesterName: string;
  approverRoles: ClanRole[];
  canDecide: boolean;
  expiresAt: string;
  decidedByName: string | null;
  resultMessage: string | null;
  createdAt: string;
}

export interface Prize {
  placement: number;
  gold: number;
  cash: number;
}

export interface ClanData {
  clan: {
    id: string;
    name: string;
    description: string | null;
    vaultGold: number;
    vaultCash: number;
    createdAt: string;
  };
  me: { userId: string; role: ClanRole };
  members: ClanMemberView[];
  vaultTransactions: {
    id: string;
    currency: string;
    amount: number;
    reason: string;
    userName: string | null;
    createdAt: string;
  }[];
  requests: ClanRequestView[];
  joinRequests: { id: string; type: string; userId: string; avatar: AvatarData; playerName: NameData; createdAt: string }[];
  tournaments: {
    id: string;
    name: string;
    description: string | null;
    startsAt: string;
    status: string;
    prizes: Prize[];
    results: { placement: number; userId: string; name: string }[] | null;
  }[];
}

export interface NoClanData {
  clan: null;
  invites: { id: string; clan: { id: string; name: string; _count: { members: number } } }[];
  myRequests: { id: string; clan: { id: string; name: string; _count: { members: number } } }[];
  clans: { id: string; name: string; description: string | null; _count: { members: number } }[];
}

export type Act = (body: Record<string, unknown>) => Promise<boolean>;
