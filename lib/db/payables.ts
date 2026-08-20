// Logique pure de répartition d'un paiement sur des dettes ouvertes (payables/receivables),
// extraite de lib/db/actions/suppliers.ts pour être testable sans dépendance à Supabase.

export type OpenDebt = {
  id: string;
  amount: number;
  amount_paid: number;
  status: string;
};

export type DebtAllocationUpdate = {
  id: string;
  amount_paid: number;
  status: string;
};

/**
 * Répartit un paiement sur une liste de dettes ouvertes, dans l'ordre fourni
 * (l'appelant doit trier par date, la plus ancienne en premier), jusqu'à
 * épuisement du montant payé. Ne modifie pas les entrées déjà soldées.
 */
export function allocatePaymentToDebts(debts: OpenDebt[], paymentAmount: number): DebtAllocationUpdate[] {
  const updates: DebtAllocationUpdate[] = [];
  let remaining = paymentAmount;

  for (const debt of debts) {
    if (remaining <= 0) break;

    const due = debt.amount - debt.amount_paid;
    if (due <= 0) continue;

    const applied = Math.min(due, remaining);
    remaining -= applied;

    const newPaid = debt.amount_paid + applied;
    const newStatus = newPaid >= debt.amount ? 'paid' : debt.status;

    updates.push({ id: debt.id, amount_paid: newPaid, status: newStatus });
  }

  return updates;
}
