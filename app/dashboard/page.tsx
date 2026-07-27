"use client";

import { useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, Boxes,
  ChevronRight, CircleDollarSign, Menu, Store, Users, Warehouse, X, ShoppingCart,
  WifiOff, Wifi, RefreshCw, Settings, UserPlus, Truck, Wallet, FileText
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Customer, Supplier } from "./types";
import { useOffline } from "../providers/OfflineProvider";
import { Metric } from "./components/metrics";
import { Charts } from "./components/charts";
import { ProductTable, MovementTable, DepotTable, CustomerTable, SupplierTable, EmployeeTable, TreasuryTable } from "./components/tables";
import { SaleForm, ProductForm, StockInflowForm, PaymentForm, CustomerForm, SupplierForm, PaySupplierForm, DepotForm, ClientForm, EmployeeForm, ExpenseForm } from "./components/forms";
import { ReceiptModal } from "./components/ReceiptModal";

import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardActions } from "./hooks/useDashboardActions";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

export default function Home() {
  const router = useRouter();
  
  const [tab, setTab] = useState("Tableau de bord");
  const [dateFilter, setDateFilter] = useState("all");
  const [modal, setModal] = useState<"product" | "movement" | "customer" | "supplier" | "depot" | "sale" | "receipt" | "new_client" | "inflow" | "payment" | "pay_supplier" | "new_employee" | "expense" | null>(null);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { isOnline, offlineQueue, syncing, lastSync, queueOfflineAction } = useOffline();

  // Load Data Hook
  const data = useDashboardData();
  const {
    products, movements, customers, suppliers, depots, employees,
    sessionLoading, storeId, setStoreId, userRole, isSuperAdmin,
    accessibleOrgs, activeOrgId, setActiveOrgId,
    lowStock, stockValue, projectedMargin, totalDebt, filtered,
    treasuryTransactions, treasuryIn, treasuryOut, netBalance
  } = data;

  // Load Actions Hook
  const {
    handleSale, handleCreateProduct, handleAddStockMovementForm,
    handlePayCustomerReceivableForm, handlePaySupplierForm,
    handleCreateClientWorkspaceForm, handleCreateEmployee, handleCreateExpense
  } = useDashboardActions(data, isOnline, queueOfflineAction, setIsSubmitting, setErrorMsg, setModal, setLastReceipt);

  const filterByDate = (rawDate: string | undefined) => {
    if (!rawDate || dateFilter === "all") return true;
    const date = new Date(rawDate);
    const now = new Date();
    if (dateFilter === "today") {
      return date.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      return date >= firstDay;
    }
    if (dateFilter === "month") {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const periodSales = treasuryTransactions.filter(t => t.flow_direction === 'in' && filterByDate(t.rawDate)).reduce((acc, t) => acc + t.net_amount, 0);
  const periodExpenses = treasuryTransactions.filter(t => t.flow_direction === 'out' && filterByDate(t.rawDate)).reduce((acc, t) => acc + t.net_amount, 0);

  const nav = [
    { label: "Tableau de bord", icon: BarChart3 },
    { label: "Produits", icon: Boxes },
    { label: "Mouvements", icon: ArrowDownLeft },
    { label: "Clients", icon: Users },
    { label: "Fournisseurs", icon: Truck },
    ...(userRole !== 'seller' ? [{ label: "Trésorerie", icon: Wallet }] : []),
    ...(userRole !== 'seller' ? [{ label: "Équipe", icon: UserPlus }] : []),
    ...(isSuperAdmin ? [{ label: "SaaS Admin", icon: Settings }] : [])
  ];

  if (sessionLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><RefreshCw className="spin" /></div>;
  }

  return (
    <main className={`app-container ${mobileNav ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand" style={{ padding: '15px 0', justifyContent: 'center' }}>
          <h1 className="logo" style={{ fontSize: '1.2rem', margin: 0 }}>DJELI'S <span style={{ color: 'var(--primary)' }}>STOCK</span></h1>
        </div>
        <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="Fermer"><X size={22} /></button>
        <div className="depot" style={{ position: 'relative' }}>
          <Warehouse size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Structure</span>
              {(isSuperAdmin || userRole !== 'seller') && (
                <button 
                  type="button" 
                  onClick={() => setModal('new_client')}
                  title="Créer une nouvelle structure"
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px', padding: '1px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  + Créer
                </button>
              )}
            </div>
            {accessibleOrgs.length > 1 ? (
              <select 
                value={activeOrgId || ''}
                onChange={(e) => {
                  const newOrgId = e.target.value;
                  setActiveOrgId(newOrgId);
                  localStorage.setItem('djelis_active_org', newOrgId);
                  window.location.reload();
                }}
                style={{ 
                  background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', 
                  width: '100%', outline: 'none', appearance: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '0.9rem', fontFamily: 'inherit'
                }}
              >
                {accessibleOrgs.map(org => <option key={org.id} value={org.id} style={{ color: '#333' }}>{org.name}</option>)}
              </select>
            ) : (
              <strong>{accessibleOrgs.find(o => o.id === activeOrgId)?.name || accessibleOrgs[0]?.name || "Structure principale"}</strong>
            )}
          </div>
          {accessibleOrgs.length > 1 && <ChevronRight size={16} style={{ transform: 'rotate(90deg)', pointerEvents: 'none' }} />}
        </div>
        <div className="depot" style={{ position: 'relative', marginTop: '0.5rem' }}>
          <Store size={18} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Boutique Active</span>
              {userRole !== 'seller' && (
                <button 
                  type="button" 
                  onClick={() => setModal('depot')}
                  title="Créer une nouvelle boutique"
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px', padding: '1px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  + Créer
                </button>
              )}
            </div>
            <select 
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                localStorage.setItem('djelis_store_id', e.target.value);
              }}
              style={{ 
                background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', 
                width: '100%', outline: 'none', appearance: 'none', cursor: 'pointer', padding: 0,
                fontSize: '0.9rem', fontFamily: 'inherit'
              }}
            >
              {depots.map(d => <option key={d.id} value={d.id} style={{ color: '#333' }}>{d.name}</option>)}
            </select>
          </div>
          {depots.length > 1 && <ChevronRight size={16} style={{ transform: 'rotate(90deg)', pointerEvents: 'none' }} />}
        </div>
        <nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? "active" : ""} onClick={() => { setTab(label); setMobileNav(false); }}><Icon size={19} />{label}</button>)}</nav>
      </aside>

      <section className="content">
        <header>
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Menu"><Menu /></button>
          <div style={{ flex: 1 }}><p>Vendredi 17 juillet 2026</p><h1>{tab}</h1></div>
          
          <div className="network-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: isOnline ? '#e8f5e9' : '#fff3e0', borderRadius: '8px', color: isOnline ? '#2e7d32' : '#e65100', fontSize: '0.9rem', marginRight: '1rem' }}>
            {syncing ? <RefreshCw size={16} className="spin" /> : (isOnline ? <Wifi size={16} /> : <WifiOff size={16} />)}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>{isOnline ? "En ligne" : "Hors ligne"}</strong>
              <small>{offlineQueue.length > 0 ? `${offlineQueue.length} action(s) en attente` : `Sync: ${lastSync}`}</small>
            </div>
            <button 
              title="Réinitialiser le cache PWA & Forcer la mise à jour"
              onClick={async () => {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const r of regs) await r.unregister();
                }
                localStorage.clear();
                window.location.reload();
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', padding: '2px 4px', marginLeft: '4px' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>


          <div className="header-actions">
            <button className="primary" onClick={() => setModal("sale")}><ShoppingCart size={18} />Vendre</button>
          </div>
        </header>

        {tab === "Tableau de bord" && <>
          <section className="welcome">
            <div>
              <span>VUE D’ENSEMBLE</span>
              <h2>Bonjour, votre boutique est sous contrôle.</h2>
              <p>Voici la situation de vos marchandises.</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '10px' }}>
              <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Période d'analyse :</label>
              <select 
                value={dateFilter} 
                onChange={e => setDateFilter(e.target.value)}
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="today" style={{ color: 'black' }}>Aujourd'hui</option>
                <option value="week" style={{ color: 'black' }}>Cette Semaine</option>
                <option value="month" style={{ color: 'black' }}>Ce Mois-ci</option>
                <option value="all" style={{ color: 'black' }}>Global (Tout)</option>
              </select>
            </div>
          </section>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>Statistiques : {dateFilter === 'all' ? 'Globales' : (dateFilter === 'today' ? 'Aujourd\'hui' : (dateFilter === 'week' ? 'Cette Semaine' : 'Ce Mois-ci'))}</h3>
          </div>
          <section className="metrics" style={{ marginBottom: '10px' }}>
            <Metric icon={Wallet} tone="green" label="Entrées (Ventes & Créances)" value={userRole !== 'seller' ? money.format(periodSales) : '***'} detail="Sur la période sélectionnée" />
            <Metric icon={ArrowDownLeft} tone="red" label="Sorties (Dépenses & Paiements)" value={userRole !== 'seller' ? money.format(periodExpenses) : '***'} detail="Sur la période sélectionnée" />
            <Metric icon={CircleDollarSign} tone="blue" label="Créances clients" value={userRole !== 'seller' ? money.format(totalDebt) : '***'} detail={`${customers.filter((c) => c.balance > 0).length} paiements en attente (Global)`} />
            <Metric icon={Boxes} tone="gold" label="Valeur du stock" value={userRole !== 'seller' ? money.format(stockValue) : '***'} detail={`${products.length} références actives (Global)`} />
          </section>

          {lowStock.length > 0 && (
            <section className="panel page-panel" style={{ marginTop: '20px', borderLeft: '4px solid #c7463d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', margin: 0, color: '#c7463d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} /> {lowStock.length} Produit(s) en rupture de stock
                  </h3>
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#666' }}>Pensez à réapprovisionner ces articles au plus vite.</p>
                </div>
                <button 
                  className="button-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#25D366', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={() => {
                    const text = `⚠️ *ALERTE RUPTURE DE STOCK - DJELI'S STOCK* ⚠️\n\nLes produits suivants doivent être réapprovisionnés :\n\n${lowStock.map(p => `- ${p.name} (Reste: ${p.quantity})`).join('\n')}\n\nMerci de faire le nécessaire.`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                >
                  Partager sur WhatsApp
                </button>
              </div>
            </section>
          )}

        </>}

        {tab === "Produits" && <section className="panel page-panel">
          {userRole !== 'seller' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
              <button className="button-secondary" onClick={() => setModal("inflow")}><ArrowDownLeft size={16} />+ Arrivage / Entrée</button>
              <button className="primary" onClick={() => setModal("product")}>+ Ajouter un produit</button>
            </div>
          )}
          <ProductTable products={filtered} />
        </section>}
        {tab === "Mouvements" && <section className="panel page-panel">
          {userRole !== 'seller' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="primary" onClick={() => setModal("inflow")}><ArrowDownLeft size={16} />+ Enregistrer un Arrivage</button>
            </div>
          )}
          <MovementTable movements={movements} />
        </section>}
        {tab === "Boutiques" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("depot")}>+ Nouvelle Boutique</button>
          </div>
          <DepotTable depots={depots} />
        </section>}
        {tab === "Clients" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("customer")}>+ Nouveau Client</button>
          </div>
          <CustomerTable customers={customers} onPay={(c) => { setSelectedCustomerForPayment(c); setModal("payment"); }} />
        </section>}
        {tab === "Fournisseurs" && <section className="panel page-panel">
          {userRole !== 'seller' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="primary" onClick={() => setModal("supplier")}>+ Nouveau Fournisseur</button>
            </div>
          )}
          <SupplierTable suppliers={suppliers} onPay={(s) => { setSelectedSupplierForPayment(s); setModal("pay_supplier"); }} />
        </section>}
        {tab === "Équipe" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("new_employee")}>+ Ajouter un employé</button>
          </div>
          <EmployeeTable employees={employees} />
        </section>}
        {tab === "Trésorerie" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Caisse & Dépenses</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Solde Net: {money.format(netBalance)}</p>
            </div>
            <button className="button-secondary" onClick={() => setModal("expense")} style={{ color: '#d32f2f', borderColor: '#d32f2f' }}>+ Nouvelle Dépense</button>
          </div>
          <TreasuryTable transactions={treasuryTransactions} />
        </section>}
        {tab === "SaaS Admin" && isSuperAdmin && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Administration Multi-Structures</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Gérez les espaces de travail de vos clients.</p>
            </div>
            <button className="primary" onClick={() => setModal('new_client')}>+ Nouvelle Structure</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Nom de la Structure</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {accessibleOrgs.map(org => (
                  <tr key={org.id}>
                    <td><small style={{ color: '#888' }}>{org.id.split('-')[0]}</small></td>
                    <td><strong>{org.name}</strong></td>
                    <td><span className="status ok">Actif</span></td>
                    <td>
                      <button className="button-secondary" onClick={() => { setActiveOrgId(org.id); localStorage.setItem('djelis_active_org', org.id); window.location.reload(); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Basculer vers cette boutique</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
        <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModal(null)}><X size={20} /></button>
          {modal === "product" && <ProductForm onClose={() => setModal(null)} onSubmit={handleCreateProduct} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "inflow" && <StockInflowForm products={products} suppliers={suppliers} onClose={() => setModal(null)} onSubmit={handleAddStockMovementForm} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "payment" && selectedCustomerForPayment && <PaymentForm customer={selectedCustomerForPayment} onClose={() => setModal(null)} onSubmit={handlePayCustomerReceivableForm} isSubmitting={isSubmitting} errorMsg={errorMsg} money={money} />}
          {modal === "pay_supplier" && selectedSupplierForPayment && <PaySupplierForm supplier={selectedSupplierForPayment} onClose={() => setModal(null)} onSubmit={handlePaySupplierForm} isSubmitting={isSubmitting} errorMsg={errorMsg} money={money} />}
          {modal === "customer" && <CustomerForm onClose={() => setModal(null)} onSubmit={handleCreateCustomer} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "supplier" && <SupplierForm onClose={() => setModal(null)} onSubmit={handleCreateSupplier} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "depot" && <DepotForm onClose={() => setModal(null)} onSubmit={handleCreateDepot} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "sale" && <SaleForm products={products} customers={customers} isSubmitting={isSubmitting} errorMsg={errorMsg} onSubmit={handleSale} />}
          {modal === "receipt" && lastReceipt && <ReceiptModal receipt={lastReceipt} onClose={() => setModal(null)} money={money} />}
          {modal === "new_client" && <ClientForm onClose={() => setModal(null)} onSubmit={handleCreateClientWorkspaceForm} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "new_employee" && <EmployeeForm depots={depots} onClose={() => setModal(null)} onSubmit={handleCreateEmployee} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "expense" && <ExpenseForm onClose={() => setModal(null)} onSubmit={handleCreateExpense} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
        </div>
      </div>}
    </main>
  );
}

