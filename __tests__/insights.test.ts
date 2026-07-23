import { 
  getMorningBrief, 
  getEveningBrief, 
  getLowStockProducts, 
  getDueReceivables,
  getPeriodComparison,
  getLocalDateString,
  StoreData, 
  InsightContext 
} from '../lib/db/insights';

describe('Insights Logic Tests', () => {
  
  const ctxBamako: InsightContext = {
    currentDateIso: "2026-07-23T10:00:00.000Z",
    timezone: "Africa/Bamako"
  };

  const emptyData: StoreData = { products: [], transactions: [], receivables: [] };

  test('getLocalDateString handles timezones correctly', () => {
    // 23h00 UTC le 22 juillet = 23h00 GMT à Bamako (même fuseau GMT) -> 22 Juillet
    expect(getLocalDateString("2026-07-22T23:00:00.000Z", "Africa/Bamako")).toBe("2026-07-22");
    
    // 23h00 UTC le 22 juillet = 08h00 le 23 juillet à Tokyo (+9)
    expect(getLocalDateString("2026-07-22T23:00:00.000Z", "Asia/Tokyo")).toBe("2026-07-23");
  });

  test('Boutique sans données ne plante pas et retourne un message d\'accueil', () => {
    const brief = getMorningBrief(emptyData, ctxBamako);
    expect(brief.message).toContain("Votre boutique est configurée");
    expect(brief.metrics.dueDebts).toBe(0);
  });

  test('Ruptures de stock et stock faible calculés correctement', () => {
    const data: StoreData = {
      ...emptyData,
      products: [
        { id: "1", name: "Riz", quantity: 50, minStock: 20 }, // OK
        { id: "2", name: "Sucre", quantity: 5, minStock: 10 }, // Low
        { id: "3", name: "Huile", quantity: 0, minStock: 5 }, // Out
        { id: "4", name: "Lait", quantity: -2, minStock: 10 } // Anomalie
      ]
    };
    
    const low = getLowStockProducts(data.products);
    expect(low).toHaveLength(3); // Sucre, Huile, Lait
    
    const brief = getMorningBrief(data, ctxBamako);
    expect(brief.metrics.lowStocks).toBe(3);
    // Doit prioriser la mention de la rupture
    expect(brief.recommendations.some(r => r.includes("Rupture de stock : Huile, Lait"))).toBeTruthy();
  });

  test('Créances à relancer inclut les dettes échues mais exclut les futures', () => {
    const data: StoreData = {
      ...emptyData,
      receivables: [
        { id: "1", customerName: "Client A", amount: 10000, amountPaid: 2000, dueDate: "2026-07-20T00:00:00.000Z", status: "open" }, // En retard (8000)
        { id: "2", customerName: "Client B", amount: 5000, amountPaid: 0, dueDate: "2026-07-23T00:00:00.000Z", status: "open" }, // Aujourd'hui (5000)
        { id: "3", customerName: "Client C", amount: 20000, amountPaid: 0, dueDate: "2026-08-01T00:00:00.000Z", status: "open" }, // Futur
        { id: "4", customerName: "Client D", amount: 10000, amountPaid: 10000, dueDate: "2026-07-10T00:00:00.000Z", status: "closed" } // Soldé
      ]
    };

    const dues = getDueReceivables(data.receivables, ctxBamako);
    expect(dues).toHaveLength(2);
    
    const brief = getMorningBrief(data, ctxBamako);
    expect(brief.metrics.dueDebts).toBe(13000); // 8000 + 5000
    expect(brief.recommendations[0]).toContain("13000 FCFA à recouvrer");
  });

  test('Résumé du soir calcule parfaitement le CA, Encaissements, et Crédits', () => {
    const data: StoreData = {
      ...emptyData,
      transactions: [
        { id: "t1", type: "SALE", totalAmount: 50000, paidAmount: 50000, createdAt: "2026-07-23T14:00:00.000Z" }, // Vente cash
        { id: "t2", type: "SALE", totalAmount: 20000, paidAmount: 5000, createdAt: "2026-07-23T16:00:00.000Z" }, // Vente mixte (15k crédit)
        { id: "t3", type: "SALE", totalAmount: 10000, paidAmount: 10000, createdAt: "2026-07-22T10:00:00.000Z" }, // Vente HIER (exclue)
        { id: "t4", type: "EXPENSE", totalAmount: 2000, paidAmount: 2000, createdAt: "2026-07-23T12:00:00.000Z" }, // Dépense
        { id: "t5", type: "PAYMENT_IN", totalAmount: 8000, paidAmount: 8000, createdAt: "2026-07-23T17:00:00.000Z" } // Remboursement dette
      ]
    };

    const brief = getEveningBrief(data, ctxBamako);
    expect(brief.metrics.salesTotal).toBe(70000); // 50k + 20k
    expect(brief.metrics.collections).toBe(63000); // 50k + 5k + 8k
    expect(brief.metrics.newCredits).toBe(15000); // 20k - 5k
    expect(brief.metrics.expenses).toBe(2000);
  });

  test('Détection des anomalies de stock négatif dans le résumé du soir', () => {
    const data: StoreData = {
      ...emptyData,
      products: [
        { id: "1", name: "Farine", quantity: -5, minStock: 10 }
      ]
    };
    const brief = getEveningBrief(data, ctxBamako);
    expect(brief.anomalies).toHaveLength(1);
    expect(brief.anomalies[0]).toContain("stock négatif");
  });

  test('Comparaison stricte avec la période précédente (J-1)', () => {
    const data: StoreData = {
      ...emptyData,
      transactions: [
        { id: "t1", type: "SALE", totalAmount: 20000, paidAmount: 20000, createdAt: "2026-07-23T14:00:00.000Z" }, // Auj: 20k
        { id: "t2", type: "SALE", totalAmount: 10000, paidAmount: 10000, createdAt: "2026-07-22T10:00:00.000Z" }, // Hier: 10k
      ]
    };

    const comp = getPeriodComparison(data, ctxBamako);
    expect(comp.today).toBe(20000);
    expect(comp.yesterday).toBe(10000);
    expect(comp.trend).toBe("up");
    expect(comp.percent).toBe(100); // +100%
    expect(comp.message).toContain("+100%");
  });

});
