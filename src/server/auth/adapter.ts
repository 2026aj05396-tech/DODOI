import "server-only";

import type { Adapter, AdapterUser } from "next-auth/adapters";

import { getAuthUserByAccount, getAuthUserById, type AuthUser } from "@/server/modules/users";

// Minimal Auth.js adapter on our own Prisma client (P1-04, decided instead of
// @auth/prisma-adapter). With JWT sessions Auth.js only reads users through it: the `signIn`
// callback has already created or linked the Google account (users module, OD-09), so Auth.js
// always finds it with `getUserByAccount` and never needs `createUser` or `linkAccount`.

function toAdapterUser(user: AuthUser): AdapterUser {
  return { id: user.id, email: user.email, emailVerified: user.emailVerified };
}

export const authAdapter: Adapter = {
  async getUser(id) {
    const user = await getAuthUserById(id);
    return user ? toAdapterUser(user) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const user = await getAuthUserByAccount(provider, providerAccountId);
    return user ? toAdapterUser(user) : null;
  },
};
