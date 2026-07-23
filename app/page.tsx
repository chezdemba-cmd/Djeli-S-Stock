"use client";

import { FormEvent, useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, Boxes,
  ChevronRight, CircleDollarSign, Menu, Store, Users, Warehouse, X, ShoppingCart,
  WifiOff, Wifi, RefreshCw, Settings
} from "lucide-react";
import { processSale, createCustomer, createStore, createClientWorkspace } from "../lib/db/business"; // Server Actions
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { createClient } from "../lib/supabase/client";
import { useRouter } from "next/navigation";

type Product = { id: string; name: string; sku: string; category: string; unit: string; quantity: number; minStock: number; purchasePrice: number; salePrice: number; };
type Movement = { id: string; product: string; type: "Entrée" | "Sortie" | "Vente"; quantity: number; date: string; author: string; };
type Customer = { id: string; name: string; phone: string; city: string; balance: number; dueDate: string; status: "À jour" | "À relancer" | "En retard"; };
type Depot = { id: string; name: string; city: string; manager: string; references: number; stockValue: number; };

const initialProducts: Product[] = [
  { id: "11111111-0000-0000-0000-000000000001", name: "Riz parfumé 25 kg", sku: "RIZ-025", category: "Céréales", unit: "Sac", quantity: 286, minStock: 80, purchasePrice: 18000, salePrice: 20000 },
  { id: "11111111-0000-0000-0000-000000000002", name: "Huile végétale 20 L", sku: "HUI-020", category: "Huiles", unit: "Bidon", quantity: 42, minStock: 30, purchasePrice: 14500, salePrice: 16500 },
];
const initialCustomers: Customer[] = [
  { id: "22222222-0000-0000-0000-000000000001", name: "Boutique Diallo Frères", phone: "+223 76 24 18 90", city: "Bamako", balance: 450000, dueDate: "20 juil. 2026", status: "À relancer" },
];

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

const speak = (text: string) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    window.speechSynthesis.speak(utterance);
  }
};

const salesData = [
  { date: '11 Juil', ventes: 450000 },
  { date: '12 Juil', ventes: 520000 },
  { date: '13 Juil', ventes: 380000 },
  { date: '14 Juil', ventes: 610000 },
  { date: '15 Juil', ventes: 590000 },
  { date: '16 Juil', ventes: 720000 },
  { date: '17 Juil', ventes: 850000 },
];

const stockData = [
  { name: 'Céréales', value: 5148000, color: '#173f35' },
  { name: 'Huiles', value: 609000, color: '#246452' },
  { name: 'Boissons', value: 340000, color: '#d7a83f' },
  { name: 'Autres', value: 120000, color: '#e7e8e3' },
];

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Tableau de bord");
  const [modal, setModal] = useState<"product" | "movement" | "customer" | "depot" | "sale" | "receipt" | "new_client" | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("Jamais");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [storeId, setStoreId] = useState<string>("mock-store-id");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessibleOrgs, setAccessibleOrgs] = useState<{id: string, name: string}[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const online = navigator.onLine;
      setIsOnline(online);

      if (online) {
        let currentActiveOrgId = localStorage.getItem('djelis_active_org');
        const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', session.user.id).single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const superAdmin = (profile as any)?.is_super_admin || false;
        setIsSuperAdmin(superAdmin);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: accessibleOrgsData, error: orgsErr } = await (supabase.rpc as any)('get_accessible_orgs');
        if (!orgsErr && accessibleOrgsData && accessibleOrgsData.length > 0) {
          setAccessibleOrgs(accessibleOrgsData);
          if (!currentActiveOrgId || !accessibleOrgsData.find((o: any) => o.id === currentActiveOrgId)) {
            currentActiveOrgId = accessibleOrgsData[0].id;
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: orgs } = await (supabase.rpc as any)('current_orgs');
          currentActiveOrgId = orgs && orgs.length > 0 ? orgs[0] : null;
        }

        if (currentActiveOrgId) {
          setActiveOrgId(currentActiveOrgId);
          localStorage.setItem('djelis_active_org', currentActiveOrgId);
        }

        let productsQuery = supabase.from('products').select('*');
        let customersQuery = supabase.from('customers').select('*').eq('active', true);
        let storesQuery = supabase.from('stores').select('*').eq('active', true);

        if (currentActiveOrgId) {
          productsQuery = productsQuery.eq('organization_id', currentActiveOrgId);
          customersQuery = customersQuery.eq('organization_id', currentActiveOrgId);
          storesQuery = storesQuery.eq('organization_id', currentActiveOrgId);
        }

        const { data: productsData } = await productsQuery;
        if (productsData && productsData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: Product[] = productsData.map((p: any) => ({
            id: p.id, name: p.name, sku: p.sku, category: p.category, unit: p.unit, 
            quantity: 100, 
            minStock: p.min_stock, purchasePrice: p.purchase_price, salePrice: p.sale_price
          }));
          setProducts(mapped);
          localStorage.setItem('djelis_products', JSON.stringify(mapped));
        }

        const { data: customersData } = await customersQuery;
        if (customersData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedCustomers: Customer[] = customersData.map((c: any) => ({
            id: c.id, name: c.name, phone: c.phone || '', city: c.city || '', balance: 0, status: 'À jour', dueDate: ''
          }));
          setCustomers(mappedCustomers);
          localStorage.setItem('djelis_customers', JSON.stringify(mappedCustomers));
        }

        let finalStores: Depot[] = [];
        const { data: storesData } = await storesQuery;
        if (storesData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalStores = storesData.map((s: any) => ({
            id: s.id, name: s.name, city: s.city || '', manager: 'Gérant', references: 0, stockValue: 0
          }));
          setDepots(finalStores);
          localStorage.setItem('djelis_stores', JSON.stringify(finalStores));
        }

        const { data: membership } = await supabase.from('memberships').select('store_id').eq('user_id', session.user.id).limit(1).single();
        if (membership) {
          const m = membership as { store_id: string };
          setStoreId(m.store_id);
          localStorage.setItem('djelis_store_id', m.store_id);
        } else if (finalStores.length > 0) {
          setStoreId(finalStores[0].id);
          localStorage.setItem('djelis_store_id', finalStores[0].id);
        }
      } else {
        setProducts(JSON.parse(localStorage.getItem('djelis_products') || "[]"));
        setCustomers(JSON.parse(localStorage.getItem('djelis_customers') || "[]"));
        setDepots(JSON.parse(localStorage.getItem('djelis_stores') || "[]"));
        setStoreId(localStorage.getItem('djelis_store_id') || "mock-store-id");
      }
      setSessionLoading(false);
    };

    checkAuthAndLoadData();
  }, [supabase, router]);

  const syncOfflineQueue = useCallback(async () => {
    const queueString = localStorage.getItem("djelis_offline_queue") || "[]";
    const queue = JSON.parse(queueString);
    if (queue.length === 0) {
      setLastSync(new Date().toLocaleTimeString());
      return;
    }
    
    setSyncing(true);
    let remainingQueue = [...queue];

    for (const action of queue) {
      try {
        if (action.type === "SALE") {
          await processSale(action.payload);
        }
        remainingQueue = remainingQueue.filter(item => item.payload.idempotency_key !== action.payload.idempotency_key);
        localStorage.setItem("djelis_offline_queue", JSON.stringify(remainingQueue));
        setOfflineQueue(remainingQueue);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error("Échec de synchronisation", e);
        // Si c'est une erreur de validation (stock, Zod UUID, etc) ou un mock_id obsolète, on jette l'action
        if (e.message && (e.message.includes('mock-store-id') || e.message.includes('uuid') || e.message.includes('Stock insuffisant') || e.message.includes('obligatoire'))) {
           remainingQueue = remainingQueue.filter(item => item.payload.idempotency_key !== action.payload.idempotency_key);
           localStorage.setItem("djelis_offline_queue", JSON.stringify(remainingQueue));
           setOfflineQueue(remainingQueue);
           continue;
        }
        break; 
      }
    }
    setSyncing(false);
    setLastSync(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    const online = navigator.onLine;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(online);
    const queue = JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfflineQueue(queue);

    if (online && queue.length > 0) {
      syncOfflineQueue();
    }

    const handleOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  const lowStock = products.filter((p) => p.quantity <= p.minStock);
  const stockValue = products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
  const projectedMargin = products.reduce((sum, p) => sum + p.quantity * (p.salePrice - p.purchasePrice), 0);
  const totalDebt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const filtered = products.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()));

  async function handleSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    const data = new FormData(event.currentTarget);
    const productId = String(data.get("product"));
    const quantity = Number(data.get("quantity"));
    const paidAmount = Number(data.get("paid_amount"));
    const customerId = String(data.get("customer_id"));
    const method = String(data.get("method"));
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const totalAmount = product.salePrice * quantity;

    if (paidAmount < totalAmount && !customerId) {
      setErrorMsg("Un client est obligatoire pour une vente à crédit.");
      setIsSubmitting(false);
      return;
    }
    
    if (quantity > product.quantity) {
      setErrorMsg("Stock insuffisant pour valider cette vente.");
      setIsSubmitting(false);
      return;
    }

    // eslint-disable-next-line react-hooks/purity
    const idempotency_key = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payload = {
      store_id: storeId,
      items: [{ product_id: productId, quantity, unit_price: product.salePrice }],
      total_amount: totalAmount,
      paid_amount: paidAmount,
      payment_method: method,
      customer_id: customerId || undefined,
      idempotency_key,
      organization_id: activeOrgId!
    };

    try {
      if (isOnline) {
        await processSale(payload).catch(() => {
          queueOfflineAction(payload);
        });
      } else {
        queueOfflineAction(payload);
      }

      setProducts(current => current.map(p => p.id === productId ? { ...p, quantity: p.quantity - quantity } : p));
      setMovements(current => [{ id: String(Date.now()), product: product.name, type: "Vente", quantity, date: "À l’instant", author: "Vous" }, ...current]);
      
      if (paidAmount < totalAmount && customerId) {
        setCustomers(current => current.map(c => c.id === customerId ? { ...c, balance: c.balance + (totalAmount - paidAmount) } : c));
      }
      
      const receiptData = {
        date: new Date().toLocaleDateString("fr-FR"),
        productName: product.name,
        quantity,
        total: totalAmount,
        paid: paidAmount,
        due: totalAmount - paidAmount,
        customerPhone: customerId ? customers.find(c => c.id === customerId)?.phone : null
      };
      setLastReceipt(receiptData);
      
      speak(`Vente confirmée. Total : ${totalAmount} francs.`);
      console.log("=== TRANSITION VERS LE RECU ===", receiptData);
      setModal("receipt");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("La création de client nécessite une connexion internet pour le moment.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      city: formData.get("city") as string,
      organization_id: activeOrgId!
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newCustomer = await createCustomer(payload) as any;
      const mappedCustomer: Customer = {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        city: newCustomer.city || '',
        balance: 0,
        status: 'À jour',
        dueDate: ''
      };
      setCustomers(current => [mappedCustomer, ...current]);
      localStorage.setItem('djelis_customers', JSON.stringify([mappedCustomer, ...customers]));
      setModal(null);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateDepot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("La création de dépôt nécessite une connexion internet pour le moment.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      city: formData.get("city") as string,
      allow_negative_stock: formData.get("allow_negative_stock") === "on",
      organization_id: activeOrgId!
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newStore = await createStore(payload) as any;
      const mappedStore: Depot = {
        id: newStore.id,
        name: newStore.name,
        city: newStore.city || '',
        manager: 'Gérant',
        references: 0,
        stockValue: 0
      };
      setDepots(current => [mappedStore, ...current]);
      localStorage.setItem('djelis_stores', JSON.stringify([mappedStore, ...depots]));
      setModal(null);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateClientWorkspaceForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Requis : connexion internet.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = { name: formData.get("name") as string };
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await createClientWorkspace(payload);
      if (result && !result.success) {
        setErrorMsg(result.error || "Erreur inconnue");
      } else {
        setModal(null);
        window.location.reload(); // Refresh to fetch new accessible orgs
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function queueOfflineAction(payload: any) {
    const action = { type: "SALE", payload, timestamp: Date.now() };
    const queue = JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]");
    queue.push(action);
    localStorage.setItem("djelis_offline_queue", JSON.stringify(queue));
    setOfflineQueue(queue);
  }

  const nav = [
    { label: "Tableau de bord", icon: BarChart3 },
    { label: "Produits", icon: Boxes },
    { label: "Mouvements", icon: ArrowDownLeft },
    { label: "Clients", icon: Users },
    ...(isSuperAdmin ? [{ label: "SaaS Admin", icon: Settings }] : [])
  ];

  if (sessionLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><RefreshCw className="spin" /></div>;
  }

  return (
    <main className={`app-container ${mobileNav ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><div className="logo">D</div><div><h1>DJELI&apos;S</h1><p>STOCK</p></div></div>
        <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="Fermer"><X size={22} /></button>
        {isSuperAdmin && (
          <div className="depot" style={{ position: 'relative' }}>
            <Warehouse size={18} />
            <div style={{ flex: 1 }}>
              <span>Espace Client (SaaS)</span>
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
                <strong>{accessibleOrgs.find(o => o.id === activeOrgId)?.name || "Boutique principale"}</strong>
              )}
            </div>
            {accessibleOrgs.length > 1 && <ChevronRight size={16} style={{ transform: 'rotate(90deg)', pointerEvents: 'none' }} />}
          </div>
        )}
        <div className="depot" style={{ position: 'relative', marginTop: isSuperAdmin ? '0.5rem' : '0', background: isSuperAdmin ? 'rgba(0,0,0,0.2)' : undefined }}>
          <Store size={18} />
          <div style={{ flex: 1 }}>
            <span>Dépôt Actif</span>
            {depots.length > 1 ? (
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
            ) : (
              <strong>{depots.length === 1 ? depots[0].name : "Aucun dépôt"}</strong>
            )}
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
          </div>


          <div className="header-actions">
            <button className="primary" onClick={() => setModal("sale")}><ShoppingCart size={18} />Vendre</button>
          </div>
        </header>

        {tab === "Tableau de bord" && <>
          <section className="welcome"><div><span>VUE D’ENSEMBLE</span><h2>Bonjour, votre dépôt est sous contrôle.</h2><p>Voici la situation de vos marchandises aujourd’hui.</p></div></section>
          <section className="metrics">
            <Metric icon={Boxes} tone="green" label="Valeur du stock" value={money.format(stockValue)} detail={`${products.length} références actives`} />
            <Metric icon={ArrowUpRight} tone="gold" label="Marge potentielle" value={money.format(projectedMargin)} detail="Sur le stock disponible" />
            <Metric icon={CircleDollarSign} tone="blue" label="Créances clients" value={money.format(totalDebt)} detail={`${customers.filter((c) => c.balance > 0).length} paiements en attente`} />
            <Metric icon={AlertTriangle} tone="red" label="Alertes de stock" value={String(lowStock.length)} detail="À réapprovisionner" />
          </section>

          <section className="charts-grid">
            <div className="chart-card">
              <h3>Évolution du Chiffre d&apos;Affaires (7 derniers jours)</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#173f35" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#173f35" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#888' }} dy={10} />
                    <YAxis tickFormatter={(val) => `${val/1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => money.format(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="ventes" stroke="#173f35" strokeWidth={3} fillOpacity={1} fill="url(#colorVentes)" activeDot={{ r: 6, strokeWidth: 0, fill: '#d7a83f' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <h3>Répartition de la valeur du Stock</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stockData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {stockData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => money.format(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>}

        {tab === "Produits" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("product")}>+ Ajouter un produit</button>
          </div>
          <ProductTable products={filtered} />
        </section>}
        {tab === "Mouvements" && <section className="panel page-panel"><MovementTable movements={movements} /></section>}
        {tab === "Dépôts" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("depot")}>+ Nouveau Dépôt</button>
          </div>
          <DepotTable depots={depots} />
        </section>}
        {tab === "Clients" && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="primary" onClick={() => setModal("customer")}>+ Nouveau Client</button>
          </div>
          <CustomerTable customers={customers} />
        </section>}
        {tab === "SaaS Admin" && isSuperAdmin && <section className="panel page-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Administration Multi-Clients</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Gérez les espaces de travail de vos clients.</p>
            </div>
            <button className="primary" onClick={() => setModal('new_client')}>+ Nouvel Espace Client</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Nom du Client (Organisation)</th><th>Statut</th><th>Actions</th></tr></thead>
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
          {modal === "product" && <ProductForm onClose={() => setModal(null)} />}
          {modal === "customer" && <CustomerForm onClose={() => setModal(null)} onSubmit={handleCreateCustomer} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "depot" && <DepotForm onClose={() => setModal(null)} onSubmit={handleCreateDepot} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
          {modal === "sale" && <SaleForm isOnline={isOnline} products={products} customers={customers} isSubmitting={isSubmitting} errorMsg={errorMsg} onSubmit={handleSale} />}
          {modal === "receipt" && lastReceipt && <ReceiptModal receipt={lastReceipt} onClose={() => setModal(null)} money={money} />}
          {modal === "new_client" && <ClientForm onClose={() => setModal(null)} onSubmit={handleCreateClientWorkspaceForm} isSubmitting={isSubmitting} errorMsg={errorMsg} />}
        </div>
      </div>}
    </main>
  );
}

function Metric({ icon: Icon, tone, label, value, detail }: { icon: typeof Boxes; tone: string; label: string; value: string; detail: string }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function ProductTable({ products }: { products: Product[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Prix de vente</th><th>État</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><span>{p.sku}</span></td><td>{p.category}</td><td><strong>{p.quantity} {p.unit.toLowerCase()}s</strong></td><td>{money.format(p.salePrice)}</td><td><span className={`status ${p.quantity <= p.minStock ? "danger" : "ok"}`}>{p.quantity <= p.minStock ? "Stock faible" : "Disponible"}</span></td></tr>)}</tbody></table></div>;
}

function MovementTable({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Aucun mouvement récent.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Auteur</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{m.date}</td><td><strong>{m.product}</strong></td><td><span className={`status ${m.type === 'Vente' || m.type === 'Sortie' ? 'danger' : 'ok'}`}>{m.type}</span></td><td>{m.quantity}</td><td>{m.author}</td></tr>)}</tbody></table></div>;
}

function DepotTable({ depots }: { depots: Depot[] }) {
  if (depots.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Aucun dépôt configuré.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Dépôt</th><th>Ville</th><th>Gérant</th><th>Références</th><th>Valeur du Stock</th></tr></thead><tbody>{depots.map((d) => <tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.city}</td><td>{d.manager}</td><td>{d.references}</td><td>{money.format(d.stockValue)}</td></tr>)}</tbody></table></div>;
}

function CustomerTable({ customers }: { customers: Customer[] }) {
  if (customers.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Aucun client enregistré.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Ville</th><th>Créance</th><th>Statut</th></tr></thead><tbody>{customers.map((c) => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone}</td><td>{c.city}</td><td>{money.format(c.balance)}</td><td><span className={`status ${c.balance > 0 ? 'danger' : 'ok'}`}>{c.balance > 0 ? c.status : 'À jour'}</span></td></tr>)}</tbody></table></div>;
}

function SaleForm({ products, customers, onSubmit, isSubmitting, errorMsg, isOnline }: { products: Product[], customers: Customer[], onSubmit: (e: FormEvent<HTMLFormElement>) => void, isSubmitting: boolean, errorMsg: string | null, isOnline: boolean }) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState(0);

  const product = products.find(p => p.id === selectedProduct);
  const total = product ? product.salePrice * qty : 0;

  return <>
    <div className="modal-heading"><div className="modal-symbol"><ShoppingCart /></div><div><h2>Nouvelle Vente</h2><p>Enregistrez une transaction manuelle.</p></div></div>
    {!isOnline && <div className="alert-warning" style={{ background: '#fff3e0', color: '#e65100', padding: '10px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>Vous êtes hors ligne. La vente sera synchronisée au retour du réseau.</div>}
    {errorMsg && <div className="alert-error" style={{ color: 'red', marginBottom: '1rem', background: '#ffebee', padding: '10px', borderRadius: '8px' }}>{errorMsg}</div>}
    <form onSubmit={onSubmit}>
      <label className="wide">Produit
        <select name="product" value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setPaid(products.find(p => p.id === e.target.value)!.salePrice * qty); }} required>
          <option value="" disabled>Sélectionner un produit...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.quantity} dispo — {money.format(p.salePrice)}/u</option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="wide">
        <label>Quantité <input name="quantity" type="number" min="1" value={qty} onChange={(e) => { const q = Number(e.target.value); setQty(q); setPaid(product ? product.salePrice * q : 0); }} required /></label>
        <label>Total (FCFA) <input type="text" value={money.format(total)} disabled style={{ background: '#f5f5f5', fontWeight: 'bold' }}/></label>
      </div>
      <label className="wide">Client (Facultatif si comptant)
        <select name="customer_id">
          <option value="">Aucun client spécifique (Vente de passage)</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="wide">
        <label>Moyen de paiement
          <select name="method">
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement Bancaire</option>
          </select>
        </label>
        <label>Montant encaissé <input name="paid_amount" type="number" min="0" max={total} value={paid} onChange={(e) => setPaid(Number(e.target.value))} required /></label>
      </div>
      {paid < total && <p style={{ gridColumn: '1 / -1', color: '#e65100', fontSize: '0.9rem', marginTop: '-0.5rem' }}>Reste à payer : {money.format(total - paid)} (Crédit)</p>}
      
      <div className="form-actions wide">
        <button type="button" onClick={() => document.querySelector('.modal-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>Annuler</button>
        <button className="primary" type="submit" disabled={isSubmitting || !product}>{isSubmitting ? "Validation..." : "Valider la vente"}</button>
      </div>
    </form>
  </>;
}

function ProductForm({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol"><Boxes /></div>
        <div><h2>Nouveau Produit</h2><p>Ajouter une référence au catalogue.</p></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onClose(); alert("Produit ajouté !"); }}>
        <label className="wide">Nom du produit <input required type="text" placeholder="Ex: Riz Parfumé" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="wide">
          <label>Catégorie <input required type="text" placeholder="Ex: Céréales" /></label>
          <label>Unité <input required type="text" placeholder="Ex: Sac, Kg, Carton" /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="wide">
          <label>Prix d&apos;Achat (FCFA) <input required type="number" min="0" /></label>
          <label>Prix de Vente (FCFA) <input required type="number" min="0" /></label>
        </div>
        <div className="form-actions wide" style={{ marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primary" type="submit">Enregistrer le produit</button>
        </div>
      </form>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReceiptModal({ receipt, onClose, money }: { receipt: any, onClose: () => void, money: Intl.NumberFormat }) {
  const text = `*DJELI'S STOCK - REÇU DE VENTE* 🧾\nDate : ${receipt.date}\n-------------------------\nProduit : ${receipt.quantity}x ${receipt.productName}\nTotal : ${money.format(receipt.total)}\nPayé : ${money.format(receipt.paid)}\nReste à Payer : ${money.format(receipt.due)}\n-------------------------\nMerci pour votre confiance !`;
  const phoneParam = receipt.customerPhone ? receipt.customerPhone.replace(/[^0-9]/g, '') : '';
  const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;

  return (
    <>
      <div className="modal-heading"><div className="modal-symbol"><ShoppingCart /></div><div><h2>Reçu</h2><p>Partager avec le client</p></div></div>
      <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{text}</pre>
      <div className="form-actions wide">
        <button type="button" onClick={onClose}>Fermer</button>
        <a href={url} target="_blank" rel="noreferrer" className="button primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Envoyer sur WhatsApp</a>
      </div>
    </>
  );
}

function CustomerForm({ onClose, onSubmit, isSubmitting, errorMsg }: { onClose: () => void, onSubmit: (e: FormEvent<HTMLFormElement>) => void, isSubmitting: boolean, errorMsg: string | null }) {
  return <>
    <div className="modal-heading"><div className="modal-symbol"><Users /></div><div><h2>Nouveau Client</h2><p>Ajouter un client à la base.</p></div></div>
    {errorMsg && <div className="alert-error" style={{ color: 'red', marginBottom: '1rem', background: '#ffebee', padding: '10px', borderRadius: '8px' }}>{errorMsg}</div>}
    <form onSubmit={onSubmit}>
      <label className="wide">Nom du client <input required type="text" name="name" placeholder="Ex: Boutique Diallo" /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="wide">
        <label>Téléphone <input type="tel" name="phone" placeholder="Ex: 01 23 45 67 89" /></label>
        <label>Ville <input type="text" name="city" placeholder="Ex: Bamako" /></label>
      </div>
      <div className="form-actions wide" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onClose}>Annuler</button>
        <button className="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Création..." : "Ajouter le client"}</button>
      </div>
    </form>
  </>;
}

function DepotForm({ onClose, onSubmit, isSubmitting, errorMsg }: { onClose: () => void, onSubmit: (e: FormEvent<HTMLFormElement>) => void, isSubmitting: boolean, errorMsg: string | null }) {
  return <>
    <div className="modal-heading"><div className="modal-symbol"><Store /></div><div><h2>Nouveau Dépôt</h2><p>Ajouter un dépôt ou une boutique.</p></div></div>
    {errorMsg && <div className="alert-error" style={{ color: 'red', marginBottom: '1rem', background: '#ffebee', padding: '10px', borderRadius: '8px' }}>{errorMsg}</div>}
    <form onSubmit={onSubmit}>
      <label className="wide">Nom du dépôt <input required type="text" name="name" placeholder="Ex: Magasin Central" /></label>
      <label className="wide">Ville <input type="text" name="city" placeholder="Ex: Bamako" /></label>
      <label className="wide" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', cursor: 'pointer' }}>
        <input type="checkbox" name="allow_negative_stock" /> Autoriser le stock négatif (Vente sans stock préalable)
      </label>
      <div className="form-actions wide" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onClose}>Annuler</button>
        <button className="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Création..." : "Ajouter le dépôt"}</button>
      </div>
    </form>
  </>;
}

function ClientForm({ onClose, onSubmit, isSubmitting, errorMsg }: { onClose: () => void, onSubmit: (e: FormEvent<HTMLFormElement>) => void, isSubmitting: boolean, errorMsg: string | null }) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol"><Warehouse /></div>
        <div><h2>Nouvel Espace Client</h2><p>Créer une organisation et un dépôt par défaut.</p></div>
      </div>
      {errorMsg && <div className="alert-error" style={{ color: 'red', marginBottom: '1rem', background: '#ffebee', padding: '10px', borderRadius: '8px' }}>{errorMsg}</div>}
      <form onSubmit={onSubmit}>
        <label className="wide">Nom de l&apos;entreprise cliente
          <input name="name" required type="text" placeholder="Ex: Quincaillerie Beta" />
        </label>
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '-0.5rem', marginBottom: '1rem' }}>Cet espace sera immédiatement disponible dans votre sélecteur.</p>
        <div className="form-actions wide">
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Création..." : "Créer l'Espace"}</button>
        </div>
      </form>
    </>
  );
}
