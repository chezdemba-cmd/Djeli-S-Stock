export type Product = {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  purchasePrice?: number | null;
  salePrice?: number | null;
};

export type Transaction = {
  id: string;
  type: 'SALE' | 'EXPENSE' | 'RESTOCK' | 'PAYMENT_IN';
  totalAmount: number; // Montant total de l'opération
  paidAmount: number; // Montant payé immédiatement
  createdAt: string; // ISO 8601 string
};

export type Receivable = {
  id: string;
  customerName: string;
  amount: number;
  amountPaid: number;
  dueDate: string; // ISO 8601 string
  status: 'open' | 'closed';
};

export type StoreData = {
  products: Product[];
  transactions: Transaction[];
  receivables: Receivable[];
};

export type InsightContext = {
  currentDateIso: string;
  timezone: string; // e.g. "Africa/Bamako"
};

// Helper: Obtenir la chaîne de date locale au format YYYY-MM-DD
export function getLocalDateString(isoDateString: string, timezone: string): string {
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback if timezone is invalid
    return isoDateString.split('T')[0];
  }
}

// 1. Produits en stock faible
export function getLowStockProducts(products: Product[]): Product[] {
  return products.filter(p => p.quantity <= p.minStock);
}

// 2. Créances à relancer (Date d'échéance dépassée ou échue aujourd'hui)
export function getDueReceivables(receivables: Receivable[], ctx: InsightContext): Receivable[] {
  const todayLocal = getLocalDateString(ctx.currentDateIso, ctx.timezone);
  
  return receivables.filter(r => {
    if (r.status === 'closed') return false;
    const dueLocal = getLocalDateString(r.dueDate, ctx.timezone);
    // Comparaison alphanumérique de YYYY-MM-DD fonctionne
    return dueLocal <= todayLocal && r.amount > r.amountPaid;
  });
}

// 3. Résumé du Matin
export function getMorningBrief(data: StoreData, ctx: InsightContext) {
  if (data.products.length === 0 && data.transactions.length === 0 && data.receivables.length === 0) {
    return {
      message: "Bonjour ! Votre boutique est configurée et prête. Enregistrez vos premiers produits pour commencer.",
      metrics: { dueDebts: 0, lowStocks: 0 },
      recommendations: ["Ajoutez des produits pour initialiser votre stock."]
    };
  }

  const lowStock = getLowStockProducts(data.products);
  const dueReceivables = getDueReceivables(data.receivables, ctx);
  const totalDueAmount = dueReceivables.reduce((acc, r) => acc + (r.amount - r.amountPaid), 0);

  let message = "Bonjour ! ";
  const recommendations: string[] = [];

  if (dueReceivables.length > 0) {
    message += `${dueReceivables.length} créance(s) arrive(nt) à échéance aujourd'hui ou sont en retard. `;
    recommendations.push(`Vous avez ${totalDueAmount} FCFA à recouvrer. Pensez à relancer ${dueReceivables.slice(0,2).map(c => c.customerName).join(', ')}${dueReceivables.length > 2 ? ' et autres' : ''}.`);
  } else {
    message += "Aucune créance en retard aujourd'hui. ";
  }

  if (lowStock.length > 0) {
    message += `${lowStock.length} produit(s) nécessitent un réapprovisionnement.`;
    const critical = lowStock.filter(p => p.quantity <= 0);
    if (critical.length > 0) {
      recommendations.push(`⚠️ Rupture de stock : ${critical.map(p => p.name).join(', ')}.`);
    } else {
      recommendations.push(`Le produit "${lowStock[0].name}" approche du seuil minimum (${lowStock[0].quantity} restant(s), seuil: ${lowStock[0].minStock}).`);
    }
  }

  return {
    message: message.trim(),
    metrics: {
      dueDebts: totalDueAmount,
      lowStocks: lowStock.length
    },
    recommendations
  };
}

// 4. Résumé du Soir et anomalies
export function getEveningBrief(data: StoreData, ctx: InsightContext) {
  const todayLocal = getLocalDateString(ctx.currentDateIso, ctx.timezone);
  
  // Filtrer les transactions d'aujourd'hui
  const todaysTx = data.transactions.filter(tx => getLocalDateString(tx.createdAt, ctx.timezone) === todayLocal);

  let salesTotal = 0;
  let collections = 0; // Encaissements (Cash in hand from sales + payments)
  let newCredits = 0;
  let expenses = 0;

  todaysTx.forEach(tx => {
    if (tx.type === 'SALE') {
      salesTotal += tx.totalAmount;
      collections += tx.paidAmount;
      if (tx.paidAmount < tx.totalAmount) {
        newCredits += (tx.totalAmount - tx.paidAmount);
      }
    } else if (tx.type === 'EXPENSE') {
      expenses += tx.totalAmount;
    } else if (tx.type === 'PAYMENT_IN') {
      collections += tx.totalAmount; // Un remboursement de dette
    }
  });

  // Détection d'anomalies
  const anomalies: string[] = [];
  if (collections < 0) anomalies.push("Les encaissements du jour sont négatifs, vérifiez vos saisies.");
  
  // Vérification basique si des ventes ont été faites mais stock 0 ou négatif
  const negativeStockProducts = data.products.filter(p => p.quantity < 0);
  if (negativeStockProducts.length > 0) {
    anomalies.push(`${negativeStockProducts.length} produit(s) ont un stock négatif (ex: ${negativeStockProducts[0].name}).`);
  }

  return {
    metrics: {
      salesTotal,
      collections,
      newCredits,
      expenses
    },
    anomalies
  };
}

// 5. Comparaison de Période (Aujourd'hui vs Hier)
export function getPeriodComparison(data: StoreData, ctx: InsightContext) {
  const currentD = new Date(ctx.currentDateIso);
  const todayLocal = getLocalDateString(currentD.toISOString(), ctx.timezone);
  
  // Calculer la date d'hier
  const yesterday = new Date(currentD.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayLocal = getLocalDateString(yesterday.toISOString(), ctx.timezone);

  const salesToday = data.transactions
    .filter(tx => tx.type === 'SALE' && getLocalDateString(tx.createdAt, ctx.timezone) === todayLocal)
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
    
  const salesYesterday = data.transactions
    .filter(tx => tx.type === 'SALE' && getLocalDateString(tx.createdAt, ctx.timezone) === yesterdayLocal)
    .reduce((sum, tx) => sum + tx.totalAmount, 0);

  let trend = "stable";
  let percent = 0;
  
  if (salesYesterday > 0) {
    percent = Math.round(((salesToday - salesYesterday) / salesYesterday) * 100);
    trend = percent > 0 ? "up" : (percent < 0 ? "down" : "stable");
  } else if (salesToday > 0) {
    trend = "up";
    percent = 100;
  }

  return {
    today: salesToday,
    yesterday: salesYesterday,
    trend,
    percent,
    message: trend === "up" ? `Vous avez vendu +${percent}% par rapport à hier.` :
             trend === "down" ? `Vos ventes sont en baisse de ${Math.abs(percent)}% par rapport à hier.` :
             `Vos ventes sont stables par rapport à hier.`
  };
}
