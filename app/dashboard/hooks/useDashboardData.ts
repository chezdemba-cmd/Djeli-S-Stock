import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useRouter } from "next/navigation";
import { Product, Movement, Customer, Supplier, Depot, TreasuryTransaction, Employee } from "../types";
import type { Database } from "../../../types/database.types";

import { createClientWorkspace } from "../../../lib/db/actions/stores";

export function useDashboardData() {
  const router = useRouter();
  const supabase = createClient();
  

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTransaction[]>([]);
  
  const [sessionLoading, setSessionLoading] = useState(true);
  const [storeId, setStoreId] = useState<string>("mock-store-id");
  const [userRole, setUserRole] = useState<string>("seller");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessibleOrgs, setAccessibleOrgs] = useState<{id: string, name: string}[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("djelis_active_org");
    }
    return null;
  });

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      if (true) {
        let currentActiveOrgId = localStorage.getItem('djelis_active_org');
        const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', session.user.id).single();
        const superAdmin = profile?.is_super_admin || false;
        setIsSuperAdmin(superAdmin);

        const { data: accessibleOrgsData, error: orgsErr } = await supabase.rpc('get_accessible_orgs');
        if (!orgsErr && accessibleOrgsData && accessibleOrgsData.length > 0) {
          setAccessibleOrgs(accessibleOrgsData);
          if (!currentActiveOrgId || !accessibleOrgsData.find((o: {id: string, name: string}) => o.id === currentActiveOrgId)) {
            currentActiveOrgId = accessibleOrgsData[0].id;
          }
        } else {
          const { data: orgs } = await supabase.rpc('current_orgs');
          if (orgs && orgs.length > 0) {
            currentActiveOrgId = orgs[0];
          }
        }

        // Fallback 1: Requête directe sur la table organizations
        if (!currentActiveOrgId) {
          const { data: directOrgs } = await supabase.from('organizations').select('id, name').limit(10);
          if (directOrgs && directOrgs.length > 0) {
            currentActiveOrgId = directOrgs[0].id;
            setAccessibleOrgs(directOrgs);
          }
        }

        // Fallback 2: Auto-création via RPC bootstrap
        if (!currentActiveOrgId) {
          const { data: rpcRes } = await supabase.rpc('bootstrap_user_organization', { p_name: "Structure Principale" });
          const bootstrapResult = rpcRes as { success: boolean; org_id?: string } | null;
          if (bootstrapResult && bootstrapResult.success && bootstrapResult.org_id) {
            currentActiveOrgId = bootstrapResult.org_id;
            setAccessibleOrgs([{ id: bootstrapResult.org_id, name: "Structure Principale" }]);
          } else {
            const autoWs = await createClientWorkspace({ name: "Structure Principale" });
            if (autoWs && autoWs.org) {
              currentActiveOrgId = autoWs.org.id;
              setAccessibleOrgs([{ id: autoWs.org.id, name: autoWs.org.name }]);
            }
          }
        }

        if (currentActiveOrgId) {
          setActiveOrgId(currentActiveOrgId);
          localStorage.setItem('djelis_active_org', currentActiveOrgId);
        }

        let productsQuery = supabase.from('products').select('*');
        let customersQuery = supabase.from('customers').select('*').eq('active', true);
        let storesQuery = supabase.from('stores').select('*').eq('active', true);
        let employeesQuery = supabase.from('org_employees').select('*');

        if (currentActiveOrgId) {
          productsQuery = productsQuery.eq('organization_id', currentActiveOrgId);
          customersQuery = customersQuery.eq('organization_id', currentActiveOrgId);
          storesQuery = storesQuery.eq('organization_id', currentActiveOrgId);
          employeesQuery = employeesQuery.eq('organization_id', currentActiveOrgId);
        }

        // Charger les quantités de stock réelles depuis la vue current_stock
        const stockMap: Record<string, number> = {};
        if (currentActiveOrgId) {
          const { data: stockData } = await supabase.from('current_stock').select('*').eq('organization_id', currentActiveOrgId);
          if (stockData) {
            stockData.forEach((s) => {
              stockMap[s.product_id] = (stockMap[s.product_id] || 0) + Number(s.quantity);
            });
          }
        }

        const { data: productsData } = await productsQuery;
        if (productsData) {
          const mapped: Product[] = productsData.map(p => ({
            id: p.id, name: p.name, sku: p.sku, category: p.category || '', unit: p.unit, 
            quantity: stockMap[p.id] ?? 0, 
            minStock: p.min_stock, purchasePrice: p.purchase_price, salePrice: p.sale_price
          }));
          setProducts(mapped);
          
        }

        // Charger les créances réelles
        const debtMap: Record<string, number> = {};
        if (currentActiveOrgId) {
          const { data: receivablesData } = await supabase.from('receivables').select('customer_id, amount, amount_paid, status').eq('organization_id', currentActiveOrgId).neq('status', 'paid');
          if (receivablesData) {
            receivablesData.forEach(r => {
              const due = Number(r.amount) - Number(r.amount_paid);
              if (due > 0) debtMap[r.customer_id] = (debtMap[r.customer_id] || 0) + due;
            });
          }
        }

        const { data: customersData } = await customersQuery;
        if (customersData) {
          const mappedCustomers: Customer[] = customersData.map(c => {
            const bal = debtMap[c.id] || 0;
            return {
              id: c.id, name: c.name, phone: c.phone || '', city: c.city || '', 
              balance: bal, status: bal > 0 ? 'À relancer' : 'À jour', dueDate: ''
            };
          });
          setCustomers(mappedCustomers);
          
        }

        // Charger les fournisseurs et dettes
        if (currentActiveOrgId) {
          const { data: supsData } = await supabase.from('suppliers').select('*').eq('organization_id', currentActiveOrgId).eq('active', true);
          const { data: paysData } = await supabase.from('payables').select('supplier_id, amount, amount_paid').eq('organization_id', currentActiveOrgId).neq('status', 'paid');
          
          const supplierDebtMap: Record<string, number> = {};
          if (paysData) {
            paysData.forEach(p => {
              const due = Number(p.amount) - Number(p.amount_paid);
              if (due > 0) supplierDebtMap[p.supplier_id] = (supplierDebtMap[p.supplier_id] || 0) + due;
            });
          }

          if (supsData) {
            const mappedSuppliers: Supplier[] = supsData.map(s => {
              const bal = supplierDebtMap[s.id] || 0;
              return {
                id: s.id, name: s.name, phone: s.phone || '', balance: bal, status: bal > 0 ? 'À régler' : 'À jour'
              };
            });
            setSuppliers(mappedSuppliers);
            
          }
        }

        // Charger l'historique réel des mouvements
        if (currentActiveOrgId) {
          const { data: movsRaw } = await supabase.from('inventory_movements').select('id, movement_type, quantity, created_at, products(name)').eq('organization_id', currentActiveOrgId).order('created_at', { ascending: false }).limit(50);
          const movsData = movsRaw as unknown as (Database['public']['Tables']['inventory_movements']['Row'])[] | null;
          if (movsData) {
            const mappedMovs: Movement[] = movsData.map(m => ({
              id: m.id,
              product: m.products ? m.products.name || 'Produit' : 'Produit',
              type: m.movement_type === 'sale' ? 'Vente' : (m.movement_type === 'purchase' ? 'Entrée' : 'Sortie'),
              quantity: Math.abs(Number(m.quantity)),
              date: new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
              rawDate: m.created_at,
              author: 'Système'
            }));
            setMovements(mappedMovs);
          }
        }

        
        // Charger la trésorerie
        if (currentActiveOrgId) {
          const { data: treasuryRaw } = await supabase.from('treasury_ledger').select('id, source_table, net_amount, flow_direction, description, payment_method, created_at, profiles(full_name)').eq('organization_id', currentActiveOrgId).order('created_at', { ascending: false }).limit(100);
          const treasuryData = treasuryRaw as unknown as (Database['public']['Views']['treasury_ledger']['Row'])[] | null;
          if (treasuryData) {
            const mappedTreasury: TreasuryTransaction[] = treasuryData.map((t) => ({
              id: t.id,
              source_table: t.source_table,
              net_amount: Number(t.net_amount),
              flow_direction: t.flow_direction,
              description: t.description,
              payment_method: t.payment_method,
              date: new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
              rawDate: t.created_at,
              author: t.profiles ? t.profiles.full_name : 'Système'
            }));
            setTreasuryTransactions(mappedTreasury);
          }
        }

        let finalStores: Depot[] = [];
        const { data: storesData } = await storesQuery;
        if (storesData && storesData.length > 0) {
          finalStores = storesData.map(s => ({
            id: s.id, name: s.name, city: s.city || '', manager: 'Gérant', references: 0, stockValue: 0
          }));
        } else {
          finalStores = [{ id: 'default-store', name: 'Boutique Principale', city: 'Bamako', manager: 'Gérant', references: 0, stockValue: 0 }];
        }
        setDepots(finalStores);
        

        const { data: employeesData } = await employeesQuery;
        if (employeesData) setEmployees(employeesData);

        const { data: membership } = await supabase.from('memberships').select('store_id, role').eq('user_id', session.user.id).eq('organization_id', currentActiveOrgId || '').limit(1).single();
        if (membership && (membership as { store_id?: string | null }).store_id) {
          const m = membership as { store_id: string, role: string };
          setStoreId(m.store_id);
          setUserRole(m.role || 'seller');
          
          
        } else if (finalStores.length > 0) {
          setStoreId(finalStores[0].id);
          setUserRole('seller');
          
          
        }
      }
      setSessionLoading(false);
    };

    checkAuthAndLoadData();
  }, [supabase, router]);





  
  const lowStock = products.filter((p) => p.quantity <= p.minStock);
  const treasuryIn = treasuryTransactions.filter(t => t.flow_direction === 'in').reduce((sum, t) => sum + t.net_amount, 0);
  const treasuryOut = treasuryTransactions.filter(t => t.flow_direction === 'out').reduce((sum, t) => sum + Math.abs(t.net_amount), 0);
  const netBalance = treasuryIn - treasuryOut;

  const stockValue = products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
  const projectedMargin = products.reduce((sum, p) => sum + p.quantity * (p.salePrice - p.purchasePrice), 0);
  const totalDebt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const filtered = products; // Cache invalidation hack 1

  return {
    products, setProducts,
    movements, setMovements,
    customers, setCustomers,
    suppliers, setSuppliers,
    depots, setDepots,
    employees, setEmployees,
    treasuryTransactions, setTreasuryTransactions,
    sessionLoading,
    storeId, setStoreId,
    userRole, setUserRole,
    isSuperAdmin, setIsSuperAdmin,
    accessibleOrgs, setAccessibleOrgs,
    activeOrgId, setActiveOrgId,
    lowStock,
    stockValue,
    projectedMargin,
    totalDebt,
    filtered,
    treasuryIn, treasuryOut, netBalance
  };
}
