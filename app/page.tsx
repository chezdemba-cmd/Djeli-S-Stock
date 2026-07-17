"use client";

import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Menu,
  PackagePlus,
  Plus,
  Search,
  Store,
  Users,
  Warehouse,
  X,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  purchasePrice: number;
  salePrice: number;
};

type Movement = {
  id: number;
  product: string;
  type: "Entrée" | "Sortie";
  quantity: number;
  date: string;
  author: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string;
  city: string;
  balance: number;
  dueDate: string;
  status: "À jour" | "À relancer" | "En retard";
};

type Depot = {
  id: number;
  name: string;
  city: string;
  manager: string;
  references: number;
  stockValue: number;
};

const initialProducts: Product[] = [
  { id: 1, name: "Riz parfumé 25 kg", sku: "RIZ-025", category: "Céréales", unit: "Sac", quantity: 286, minStock: 80, purchasePrice: 18000, salePrice: 20000 },
  { id: 2, name: "Huile végétale 20 L", sku: "HUI-020", category: "Huiles", unit: "Bidon", quantity: 42, minStock: 30, purchasePrice: 14500, salePrice: 16500 },
  { id: 3, name: "Sucre cristallisé 50 kg", sku: "SUC-050", category: "Épicerie", unit: "Sac", quantity: 18, minStock: 25, purchasePrice: 26000, salePrice: 28500 },
  { id: 4, name: "Lait en poudre x24", sku: "LAI-024", category: "Produits laitiers", unit: "Carton", quantity: 96, minStock: 35, purchasePrice: 21000, salePrice: 24000 },
  { id: 5, name: "Boisson gingembre x12", sku: "BOI-012", category: "Boissons", unit: "Casier", quantity: 12, minStock: 20, purchasePrice: 7200, salePrice: 9000 },
];

const initialMovements: Movement[] = [
  { id: 1, product: "Riz parfumé 25 kg", type: "Sortie", quantity: 40, date: "Aujourd’hui, 10:42", author: "Moussa K." },
  { id: 2, product: "Huile végétale 20 L", type: "Entrée", quantity: 25, date: "Aujourd’hui, 09:18", author: "Awa D." },
  { id: 3, product: "Lait en poudre x24", type: "Sortie", quantity: 12, date: "Hier, 17:05", author: "Moussa K." },
];

const initialCustomers: Customer[] = [
  { id: 1, name: "Boutique Diallo Frères", phone: "+223 76 24 18 90", city: "Bamako", balance: 450000, dueDate: "20 juil. 2026", status: "À relancer" },
  { id: 2, name: "Établissements Konaté", phone: "+223 66 81 03 42", city: "Kati", balance: 300000, dueDate: "12 juil. 2026", status: "En retard" },
  { id: 3, name: "Superette Aminata", phone: "+223 70 55 29 10", city: "Bamako", balance: 0, dueDate: "—", status: "À jour" },
  { id: 4, name: "Commerce Sangaré", phone: "+223 75 10 66 21", city: "Koulikoro", balance: 500000, dueDate: "25 juil. 2026", status: "À relancer" },
];

const initialDepots: Depot[] = [
  { id: 1, name: "Dépôt central Bamako", city: "Bamako", manager: "Moussa K.", references: 126, stockValue: 12350000 },
  { id: 2, name: "Dépôt secondaire Kati", city: "Kati", manager: "Awa D.", references: 48, stockValue: 4725000 },
];

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

export default function Home() {
  const [products, setProducts] = useState(initialProducts);
  const [movements, setMovements] = useState(initialMovements);
  const [customers, setCustomers] = useState(initialCustomers);
  const [depots, setDepots] = useState(initialDepots);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Tableau de bord");
  const [modal, setModal] = useState<"product" | "movement" | "customer" | "depot" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const lowStock = products.filter((p) => p.quantity <= p.minStock);
  const stockValue = products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
  const projectedMargin = products.reduce((sum, p) => sum + p.quantity * (p.salePrice - p.purchasePrice), 0);
  const totalDebt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const filtered = products.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()));

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const product: Product = {
      id: Date.now(),
      name: String(data.get("name")),
      sku: String(data.get("sku")),
      category: String(data.get("category")),
      unit: String(data.get("unit")),
      quantity: Number(data.get("quantity")),
      minStock: Number(data.get("minStock")),
      purchasePrice: Number(data.get("purchasePrice")),
      salePrice: Number(data.get("salePrice")),
    };
    setProducts((current) => [product, ...current]);
    setModal(null);
  }

  function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const productId = Number(data.get("product"));
    const type = String(data.get("type")) as "Entrée" | "Sortie";
    const quantity = Number(data.get("quantity"));
    const product = products.find((item) => item.id === productId);
    if (!product || quantity <= 0 || (type === "Sortie" && quantity > product.quantity)) return;
    setProducts((current) => current.map((item) => item.id === productId ? { ...item, quantity: item.quantity + (type === "Entrée" ? quantity : -quantity) } : item));
    setMovements((current) => [{ id: Date.now(), product: product.name, type, quantity, date: "À l’instant", author: "Vous" }, ...current]);
    setModal(null);
  }

  function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const balance = Number(data.get("balance"));
    setCustomers((current) => [{
      id: Date.now(),
      name: String(data.get("name")),
      phone: String(data.get("phone")),
      city: String(data.get("city")),
      balance,
      dueDate: String(data.get("dueDate") || "—"),
      status: balance > 0 ? "À relancer" : "À jour",
    }, ...current]);
    setModal(null);
  }

  function addDepot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDepots((current) => [{
      id: Date.now(),
      name: String(data.get("name")),
      city: String(data.get("city")),
      manager: String(data.get("manager")),
      references: 0,
      stockValue: 0,
    }, ...current]);
    setModal(null);
  }

  const nav = [
    { label: "Tableau de bord", icon: BarChart3 },
    { label: "Produits", icon: Boxes },
    { label: "Mouvements", icon: ArrowDownLeft },
    { label: "Dépôts", icon: Warehouse },
    { label: "Clients", icon: Users },
  ];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">D</div><div><strong>DJELI&apos;S</strong><span>STOCK</span></div></div>
        <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="Fermer"><X size={22} /></button>
        <div className="depot"><Store size={18} /><div><span>Dépôt sélectionné</span><strong>Dépôt central Bamako</strong></div><ChevronRight size={16} /></div>
        <nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? "active" : ""} onClick={() => { setTab(label); setMobileNav(false); }}><Icon size={19} />{label}</button>)}</nav>
        <div className="user-card"><div className="avatar">DD</div><div><strong>Demba Diabaté</strong><span>Propriétaire</span></div></div>
      </aside>

      <section className="content">
        <header>
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Menu"><Menu /></button>
          <div><p>Vendredi 17 juillet 2026</p><h1>{tab}</h1></div>
          <div className="header-actions"><button className="icon-button" aria-label="Notifications"><Bell size={20} /><i /></button><button className="primary" onClick={() => setModal("movement")}><PackagePlus size={18} />Nouveau mouvement</button></div>
        </header>

        {tab === "Tableau de bord" && <>
          <section className="welcome"><div><span>VUE D’ENSEMBLE</span><h2>Bonjour Demba, votre dépôt est sous contrôle.</h2><p>Voici la situation de vos marchandises aujourd’hui.</p></div><button onClick={() => setModal("product")}><Plus size={18} />Ajouter un produit</button></section>
          <section className="metrics">
            <Metric icon={Boxes} tone="green" label="Valeur du stock" value={money.format(stockValue)} detail={`${products.length} références actives`} />
            <Metric icon={ArrowUpRight} tone="gold" label="Marge potentielle" value={money.format(projectedMargin)} detail="Sur le stock disponible" />
            <Metric icon={CircleDollarSign} tone="blue" label="Créances clients" value={money.format(totalDebt)} detail={`${customers.filter((customer) => customer.balance > 0).length} paiements en attente`} />
            <Metric icon={AlertTriangle} tone="red" label="Alertes de stock" value={String(lowStock.length)} detail="À réapprovisionner" />
          </section>
          <section className="grid-two">
            <div className="panel"><PanelTitle title="Mouvements récents" action="Tout afficher" onClick={() => setTab("Mouvements")} />
              <div className="movement-list">{movements.slice(0, 4).map((movement) => <div className="movement" key={movement.id}><div className={movement.type === "Entrée" ? "move-icon in" : "move-icon out"}>{movement.type === "Entrée" ? <ArrowDownLeft /> : <ArrowUpRight />}</div><div className="move-main"><strong>{movement.product}</strong><span>{movement.date} · {movement.author}</span></div><div className={movement.type === "Entrée" ? "qty in" : "qty out"}>{movement.type === "Entrée" ? "+" : "−"}{movement.quantity}<span>{movement.type}</span></div></div>)}</div>
            </div>
            <div className="panel"><PanelTitle title="Stocks à surveiller" action="Voir les produits" onClick={() => setTab("Produits")} />
              <div className="alerts">{lowStock.map((product) => <div className="alert-row" key={product.id}><div><strong>{product.name}</strong><span>{product.sku} · Seuil {product.minStock} {product.unit.toLowerCase()}s</span></div><div><strong>{product.quantity}</strong><span>{product.unit}s restantes</span></div></div>)}</div>
            </div>
          </section>
        </>}

        {tab === "Produits" && <section className="panel page-panel"><div className="toolbar"><div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit, une référence…" /></div><button className="primary" onClick={() => setModal("product")}><Plus size={18} />Ajouter</button></div><ProductTable products={filtered} /></section>}
        {tab === "Mouvements" && <section className="panel page-panel"><div className="toolbar"><div><h2>Journal des mouvements</h2><p>Chaque entrée et sortie reste traçable.</p></div><button className="primary" onClick={() => setModal("movement")}><Plus size={18} />Enregistrer</button></div><div className="movement-list full">{movements.map((m) => <div className="movement" key={m.id}><div className={m.type === "Entrée" ? "move-icon in" : "move-icon out"}>{m.type === "Entrée" ? <ArrowDownLeft /> : <ArrowUpRight />}</div><div className="move-main"><strong>{m.product}</strong><span>{m.date} · {m.author}</span></div><div className={m.type === "Entrée" ? "qty in" : "qty out"}>{m.type === "Entrée" ? "+" : "−"}{m.quantity}<span>{m.type}</span></div></div>)}</div></section>}
        {tab === "Dépôts" && <DepotSection depots={depots} onAdd={() => setModal("depot")} />}
        {tab === "Clients" && <CustomerSection customers={customers} onAdd={() => setModal("customer")} />}
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X /></button>
        {modal === "product" && <ProductForm onSubmit={addProduct} />}
        {modal === "movement" && <MovementForm products={products} onSubmit={addMovement} />}
        {modal === "customer" && <CustomerForm onSubmit={addCustomer} />}
        {modal === "depot" && <DepotForm onSubmit={addDepot} />}
      </div></div>}
    </main>
  );
}

function Metric({ icon: Icon, tone, label, value, detail }: { icon: typeof Boxes; tone: string; label: string; value: string; detail: string }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function PanelTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="panel-title"><h3>{title}</h3><button onClick={onClick}>{action}<ChevronRight size={16} /></button></div>;
}

function ProductTable({ products }: { products: Product[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Prix de vente</th><th>État</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><span>{p.sku}</span></td><td>{p.category}</td><td><strong>{p.quantity} {p.unit.toLowerCase()}s</strong></td><td>{money.format(p.salePrice)}</td><td><span className={`status ${p.quantity <= p.minStock ? "danger" : "ok"}`}>{p.quantity <= p.minStock ? "Stock faible" : "Disponible"}</span></td></tr>)}</tbody></table></div>;
}

function ProductForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="modal-heading"><div className="modal-symbol"><Boxes /></div><div><h2>Ajouter un produit</h2><p>Créez une nouvelle référence dans votre dépôt.</p></div></div><form onSubmit={onSubmit}><label className="wide">Nom du produit<input name="name" required placeholder="Ex. Riz parfumé 25 kg" /></label><label>Référence<input name="sku" required placeholder="RIZ-025" /></label><label>Catégorie<input name="category" required placeholder="Céréales" /></label><label>Unité<select name="unit"><option>Sac</option><option>Carton</option><option>Bidon</option><option>Casier</option><option>Unité</option></select></label><label>Quantité initiale<input name="quantity" type="number" min="0" required defaultValue="0" /></label><label>Prix d’achat (FCFA)<input name="purchasePrice" type="number" min="0" required /></label><label>Prix de vente (FCFA)<input name="salePrice" type="number" min="0" required /></label><label className="wide">Seuil d’alerte<input name="minStock" type="number" min="0" required defaultValue="10" /></label><div className="form-actions wide"><button type="button" onClick={() => history.back()}>Annuler</button><button className="primary" type="submit">Ajouter le produit</button></div></form></>;
}

function MovementForm({ products, onSubmit }: { products: Product[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="modal-heading"><div className="modal-symbol"><PackagePlus /></div><div><h2>Nouveau mouvement</h2><p>Enregistrez une entrée ou une sortie traçable.</p></div></div><form onSubmit={onSubmit}><label className="wide">Produit<select name="product">{products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.quantity} disponibles</option>)}</select></label><label>Type<select name="type"><option>Entrée</option><option>Sortie</option></select></label><label>Quantité<input name="quantity" type="number" min="1" required /></label><label className="wide">Motif<input name="reason" required placeholder="Livraison fournisseur, vente client…" /></label><div className="form-actions wide"><button type="button">Annuler</button><button className="primary" type="submit">Valider le mouvement</button></div></form></>;
}

function DepotSection({ depots, onAdd }: { depots: Depot[]; onAdd: () => void }) {
  return <section className="page-stack"><div className="toolbar section-toolbar"><div><h2>Vos dépôts</h2><p>Suivez la valeur et le responsable de chaque entrepôt.</p></div><button className="primary" onClick={onAdd}><Plus size={18} />Nouveau dépôt</button></div><div className="depot-grid">{depots.map((depot) => <article className="depot-card" key={depot.id}><div className="depot-card-icon"><Warehouse /></div><span>{depot.city}</span><h3>{depot.name}</h3><p>Responsable : <strong>{depot.manager}</strong></p><div className="depot-stats"><div><span>Références</span><strong>{depot.references}</strong></div><div><span>Valeur du stock</span><strong>{money.format(depot.stockValue)}</strong></div></div><button>Consulter le dépôt <ChevronRight size={16} /></button></article>)}</div></section>;
}

function CustomerSection({ customers, onAdd }: { customers: Customer[]; onAdd: () => void }) {
  const debt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  return <section className="panel page-panel"><div className="toolbar"><div><h2>Clients revendeurs</h2><p>{money.format(debt)} de créances à suivre.</p></div><button className="primary" onClick={onAdd}><Plus size={18} />Nouveau client</button></div><div className="table-wrap"><table><thead><tr><th>Client</th><th>Ville</th><th>Solde dû</th><th>Échéance</th><th>État</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><span>{customer.phone}</span></td><td>{customer.city}</td><td><strong>{money.format(customer.balance)}</strong></td><td>{customer.dueDate}</td><td><span className={`status ${customer.status === "À jour" ? "ok" : customer.status === "En retard" ? "danger" : "waiting"}`}>{customer.status}</span></td></tr>)}</tbody></table></div></section>;
}

function CustomerForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="modal-heading"><div className="modal-symbol"><Users /></div><div><h2>Nouveau client revendeur</h2><p>Ajoutez ses coordonnées et son éventuel solde initial.</p></div></div><form onSubmit={onSubmit}><label className="wide">Nom commercial<input name="name" required placeholder="Ex. Boutique Diallo Frères" /></label><label>Téléphone<input name="phone" required placeholder="+223…" /></label><label>Ville<input name="city" required placeholder="Bamako" /></label><label>Solde dû (FCFA)<input name="balance" type="number" min="0" defaultValue="0" /></label><label>Échéance<input name="dueDate" type="date" /></label><div className="form-actions wide"><button type="button">Annuler</button><button className="primary" type="submit">Ajouter le client</button></div></form></>;
}

function DepotForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <><div className="modal-heading"><div className="modal-symbol"><Warehouse /></div><div><h2>Ajouter un dépôt</h2><p>Créez un nouvel emplacement de stockage.</p></div></div><form onSubmit={onSubmit}><label className="wide">Nom du dépôt<input name="name" required placeholder="Ex. Dépôt secondaire Sikasso" /></label><label>Ville<input name="city" required placeholder="Sikasso" /></label><label>Responsable<input name="manager" required placeholder="Nom du gestionnaire" /></label><div className="form-actions wide"><button type="button">Annuler</button><button className="primary" type="submit">Créer le dépôt</button></div></form></>;
}
