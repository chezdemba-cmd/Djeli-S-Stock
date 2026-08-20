import { allocatePaymentToDebts, OpenDebt } from '../lib/db/payables';

describe('allocatePaymentToDebts — répartition des paiements en cascade', () => {
  test('solde intégralement une seule dette avec un paiement exact', () => {
    const debts: OpenDebt[] = [{ id: 'd1', amount: 10000, amount_paid: 0, status: 'open' }];
    const updates = allocatePaymentToDebts(debts, 10000);
    expect(updates).toEqual([{ id: 'd1', amount_paid: 10000, status: 'paid' }]);
  });

  test('paiement partiel : la dette reste open avec le solde à jour', () => {
    const debts: OpenDebt[] = [{ id: 'd1', amount: 10000, amount_paid: 0, status: 'open' }];
    const updates = allocatePaymentToDebts(debts, 4000);
    expect(updates).toEqual([{ id: 'd1', amount_paid: 4000, status: 'open' }]);
  });

  test('répartit un paiement sur plusieurs dettes, dans l\'ordre fourni, jusqu\'à épuisement', () => {
    const debts: OpenDebt[] = [
      { id: 'd1', amount: 5000, amount_paid: 0, status: 'open' },   // soldée par 5000
      { id: 'd2', amount: 8000, amount_paid: 0, status: 'late' },   // reçoit le reste : 3000
      { id: 'd3', amount: 6000, amount_paid: 0, status: 'open' },   // ne reçoit rien
    ];
    const updates = allocatePaymentToDebts(debts, 8000);
    expect(updates).toEqual([
      { id: 'd1', amount_paid: 5000, status: 'paid' },
      { id: 'd2', amount_paid: 3000, status: 'late' },
    ]);
  });

  test('un paiement excédentaire ne dépasse jamais le montant réellement dû (pas de solde négatif)', () => {
    const debts: OpenDebt[] = [{ id: 'd1', amount: 5000, amount_paid: 0, status: 'open' }];
    const updates = allocatePaymentToDebts(debts, 999999);
    expect(updates).toEqual([{ id: 'd1', amount_paid: 5000, status: 'paid' }]);
  });

  test('ignore les dettes déjà soldées (due <= 0) même si elles sont dans la liste', () => {
    const debts: OpenDebt[] = [
      { id: 'd1', amount: 5000, amount_paid: 5000, status: 'paid' }, // déjà soldée
      { id: 'd2', amount: 3000, amount_paid: 0, status: 'open' },
    ];
    const updates = allocatePaymentToDebts(debts, 3000);
    expect(updates).toEqual([{ id: 'd2', amount_paid: 3000, status: 'paid' }]);
  });

  test('un paiement de zéro ou négatif ne modifie aucune dette', () => {
    const debts: OpenDebt[] = [{ id: 'd1', amount: 5000, amount_paid: 0, status: 'open' }];
    expect(allocatePaymentToDebts(debts, 0)).toEqual([]);
    expect(allocatePaymentToDebts(debts, -100)).toEqual([]);
  });

  test('une liste de dettes vide ne renvoie aucune mise à jour', () => {
    expect(allocatePaymentToDebts([], 10000)).toEqual([]);
  });

  test('conserve le paiement partiel déjà existant sur une dette avant de la solder', () => {
    const debts: OpenDebt[] = [{ id: 'd1', amount: 10000, amount_paid: 6000, status: 'open' }];
    const updates = allocatePaymentToDebts(debts, 4000);
    expect(updates).toEqual([{ id: 'd1', amount_paid: 10000, status: 'paid' }]);
  });
});
