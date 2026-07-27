import { Product, Movement, Depot, Customer, Supplier } from "../types";

export function ProductTable({ products }: { products: Product[] }) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Catégorie</th>
            <th>Stock</th>
            <th>Prix de vente</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.name}</strong>
                <span>{p.sku}</span>
              </td>
              <td>{p.category}</td>
              <td>
                <strong>
                  {p.quantity} {p.unit.toLowerCase()}s
                </strong>
              </td>
              <td>{money.format(p.salePrice)}</td>
              <td>
                <span className={`status ${p.quantity <= p.minStock ? "danger" : "ok"}`}>
                  {p.quantity <= p.minStock ? "Stock faible" : "Disponible"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MovementTable({ movements }: { movements: Movement[] }) {
  if (movements.length === 0)
    return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Aucun mouvement récent.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Produit</th>
            <th>Type</th>
            <th>Quantité</th>
            <th>Auteur</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>{m.date}</td>
              <td>
                <strong>{m.product}</strong>
              </td>
              <td>
                <span className={`status ${m.type === "Vente" || m.type === "Sortie" ? "danger" : "ok"}`}>{m.type}</span>
              </td>
              <td>{m.quantity}</td>
              <td>{m.author}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DepotTable({ depots }: { depots: Depot[] }) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
  if (depots.length === 0)
    return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Aucun dépôt configuré.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Dépôt</th>
            <th>Ville</th>
            <th>Gérant</th>
            <th>Références</th>
            <th>Valeur du Stock</th>
          </tr>
        </thead>
        <tbody>
          {depots.map((d) => (
            <tr key={d.id}>
              <td>
                <strong>{d.name}</strong>
              </td>
              <td>{d.city}</td>
              <td>{d.manager}</td>
              <td>{d.references}</td>
              <td>{money.format(d.stockValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerTable({ customers, onPay }: { customers: Customer[]; onPay: (c: Customer) => void }) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
  if (customers.length === 0)
    return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Aucun client enregistré.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Contact</th>
            <th>Ville</th>
            <th>Créance</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.name}</strong>
              </td>
              <td>{c.phone}</td>
              <td>{c.city}</td>
              <td>
                <strong style={{ color: c.balance > 0 ? "#d32f2f" : "inherit" }}>{money.format(c.balance)}</strong>
              </td>
              <td>
                <span className={`status ${c.balance > 0 ? "danger" : "ok"}`}>
                  {c.balance > 0 ? c.status : "À jour"}
                </span>
              </td>
              <td>
                {c.balance > 0 ? (
                  <button
                    className="button-secondary"
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
                    onClick={() => onPay(c)}
                  >
                    💰 Rembourser
                  </button>
                ) : (
                  <span style={{ color: "#888", fontSize: "0.8rem" }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SupplierTable({ suppliers, onPay }: { suppliers: Supplier[]; onPay: (s: Supplier) => void }) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
  if (suppliers.length === 0)
    return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Aucun fournisseur enregistré.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fournisseur</th>
            <th>Contact</th>
            <th>Dette (À payer)</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.name}</strong>
              </td>
              <td>{s.phone}</td>
              <td>
                <strong style={{ color: s.balance > 0 ? "#d32f2f" : "inherit" }}>{money.format(s.balance)}</strong>
              </td>
              <td>
                <span className={`status ${s.balance > 0 ? "danger" : "ok"}`}>
                  {s.balance > 0 ? s.status : "À jour"}
                </span>
              </td>
              <td>
                {s.balance > 0 ? (
                  <button
                    className="button-secondary"
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
                    onClick={() => onPay(s)}
                  >
                    💸 Payer
                  </button>
                ) : (
                  <span style={{ color: "#888", fontSize: "0.8rem" }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EmployeeTable({ employees }: { employees: any[] }) {
  if (employees.length === 0)
    return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Aucun employé enregistré.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Rôle</th>
            <th>Dépôt assigné</th>
            <th>Date d'ajout</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.membership_id}>
              <td>
                <strong>{emp.full_name}</strong>
              </td>
              <td>
                {emp.role === "owner"
                  ? "Propriétaire"
                  : emp.role === "manager"
                  ? "Gérant"
                  : "Caissier / Vendeur"}
              </td>
              <td>{emp.store_name || "-"}</td>
              <td>{new Date(emp.created_at).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TreasuryTable({ transactions, money }: { transactions: any[]; money: Intl.NumberFormat }) {
  if (transactions.length === 0) return <p className="empty-state">Aucune transaction enregistr�e.</p>;
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Moyen</th>
            <th>Auteur</th>
            <th className="numeric">Montant</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>
                <span className={t.flow_direction === 'in' ? 'status status-completed' : 'status status-pending'}>
                  {t.flow_direction === 'in' ? 'Entrée' : 'Sortie'}
                </span>
              </td>
              <td>{t.description}</td>
              <td>{t.payment_method === 'cash' ? 'Espèces' : t.payment_method}</td>
              <td>{t.author}</td>
              <td className="numeric" style={{ color: t.flow_direction === 'in' ? '#2e7d32' : '#d32f2f', fontWeight: 'bold' }}>
                {t.flow_direction === 'in' ? '+' : '-'}{money.format(Math.abs(t.net_amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
