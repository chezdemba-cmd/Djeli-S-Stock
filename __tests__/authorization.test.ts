// Test de non-régression pour la faille de cloisonnement multi-entreprises (SEC-01) :
// getOrCreateUserOrg() ne doit jamais faire confiance à un organization_id fourni par
// le client sans vérifier que l'utilisateur en est réellement membre.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const maybeSingleMock = jest.fn();
const fromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: maybeSingleMock,
};
const fromMock = jest.fn(() => fromChain);

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: fromMock })),
}));

import { getOrCreateUserOrg } from "../lib/db/actions/auth";

describe("getOrCreateUserOrg — cloisonnement multi-entreprises", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    fromMock.mockClear();
  });

  test("refuse un organization_id d'une organisation dont l'utilisateur n'est pas membre", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null });

    await expect(
      getOrCreateUserOrg("user-A", "a@example.com", "org-appartenant-a-une-autre-entreprise")
    ).rejects.toThrow(/Accès refusé/i);

    // La vérification doit interroger la table memberships avec l'utilisateur ET l'org visée.
    expect(fromMock).toHaveBeenCalledWith("memberships");
    expect(fromChain.eq).toHaveBeenCalledWith("user_id", "user-A");
    expect(fromChain.eq).toHaveBeenCalledWith("organization_id", "org-appartenant-a-une-autre-entreprise");
  });

  test("accepte un organization_id dont l'utilisateur est bien membre", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { organization_id: "org-B", store_id: "store-1" },
    });

    const result = await getOrCreateUserOrg("user-A", "a@example.com", "org-B");

    expect(result).toEqual({ orgId: "org-B", storeId: "store-1" });
  });
});
