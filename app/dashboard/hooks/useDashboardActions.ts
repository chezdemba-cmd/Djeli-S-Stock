import { FormEvent, Dispatch, SetStateAction } from "react";
import { processSale, payReceivable, cancelMovement } from "../../../lib/db/actions/sales";
import { createCustomer } from "../../../lib/db/actions/customers";
import { createStore, createPartnerWorkspace, createEmployee } from "../../../lib/db/actions/stores";
import { createProduct, addStockMovement } from "../../../lib/db/actions/products";
import { createSupplier, paySupplier } from "../../../lib/db/actions/suppliers";
import { createExpense } from "../../../lib/db/actions/treasury";
import { Product, Movement, Customer, Supplier, Depot, TreasuryTransaction, ModalType, Receipt } from "../types";
import type { OfflineAction } from "../../providers/OfflineProvider";
import type { Database } from "../../../types/database.types";

// Les server actions renvoient { data } en cas de succès ou { error } en cas d'échec ;
// on force ici un vrai type discriminé (au lieu du type inféré où data/error sont
// optionnels des deux côtés) pour que `'error' in response` se resserre correctement.
type ActionResponse<T> = { data: T } | { error: string };

interface DashboardData {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  movements: Movement[];
  setMovements: Dispatch<SetStateAction<Movement[]>>;
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  depots: Depot[];
  setDepots: Dispatch<SetStateAction<Depot[]>>;
  storeId: string;
  setStoreId: Dispatch<SetStateAction<string>>;
  activeOrgId: string | null;
  treasuryTransactions: TreasuryTransaction[];
  setTreasuryTransactions: Dispatch<SetStateAction<TreasuryTransaction[]>>;
  accessibleOrgs: {id: string, name: string}[];
}

const speak = (text: string) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    window.speechSynthesis.speak(utterance);
  }
};

export function useDashboardActions(
  data: DashboardData,
  isOnline: boolean,
  queueOfflineAction: (action: OfflineAction) => void,
  setIsSubmitting: Dispatch<SetStateAction<boolean>>,
  setErrorMsg: Dispatch<SetStateAction<string | null>>,
  setModal: Dispatch<SetStateAction<ModalType>>,
  setLastReceipt: Dispatch<SetStateAction<Receipt | null>>
) {
  const { products, setProducts, setTreasuryTransactions, setMovements, customers, setCustomers, suppliers, setSuppliers, depots, setDepots, storeId, setStoreId, activeOrgId, accessibleOrgs } = data;

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

    const idempotency_key = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const payload = {
      store_id: storeId,
      items: [{ product_id: productId, quantity, unit_price: product.salePrice }],
      total_amount: totalAmount,
      paid_amount: paidAmount,
      payment_method: method,
      customer_id: customerId || undefined,
      idempotency_key,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };

    try {
      if (isOnline) {
        await processSale(payload).catch(() => {
          queueOfflineAction({ type: "SALE", payload });
        });
      } else {
        queueOfflineAction({ type: "SALE", payload });
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
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createCustomer(payload) as ActionResponse<Database['public']['Tables']['customers']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        const newCustomer = response.data;
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
      }
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
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createStore(payload) as ActionResponse<Database['public']['Tables']['stores']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        const newStore = response.data;
        const mappedStore: Depot = {
          id: newStore.id,
          name: newStore.name,
          city: newStore.city || '',
          manager: 'Gérant',
          references: 0,
          stockValue: 0
        };
        setDepots(current => [mappedStore, ...current]);
        setStoreId(newStore.id);
        localStorage.setItem('djelis_stores', JSON.stringify([mappedStore, ...depots]));
        localStorage.setItem('djelis_store_id', newStore.id);
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("La création de produit nécessite une connexion internet.");
      setIsSubmitting(false);
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      unit: formData.get("unit") as string,
      purchase_price: Number(formData.get("purchase_price")),
      sale_price: Number(formData.get("sale_price")),
      min_stock: Number(formData.get("min_stock") || 0),
      initial_quantity: Number(formData.get("initial_quantity") || 0),
      store_id: storeId,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createProduct(payload) as ActionResponse<Database['public']['Tables']['products']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        const p = response.data;
        const mappedProduct: Product = {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category || '',
          unit: p.unit,
          quantity: payload.initial_quantity,
          minStock: p.min_stock,
          purchasePrice: p.purchase_price,
          salePrice: p.sale_price
        };
        setProducts(current => [mappedProduct, ...current]);
        localStorage.setItem('djelis_products', JSON.stringify([mappedProduct, ...products]));
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddStockMovementForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("L'enregistrement de mouvement nécessite une connexion internet.");
      setIsSubmitting(false);
      return;
    }
    const formData = new FormData(event.currentTarget);
    const productId = formData.get("product_id") as string;
    const quantity = Number(formData.get("quantity"));
    const payload = {
      store_id: storeId,
      product_id: productId,
      quantity: quantity,
      movement_type: 'purchase' as const,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || '',
      supplier_id: formData.get("supplier_id") as string || undefined,
      payable_amount: Number(formData.get("payable_amount") || 0),
      amount_paid: Number(formData.get("amount_paid") || 0),
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await addStockMovement(payload) as ActionResponse<Database['public']['Tables']['inventory_movements']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        setProducts(current => current.map(p => p.id === productId ? { ...p, quantity: p.quantity + quantity } : p));
        const prd = products.find(p => p.id === productId);
        setMovements(current => [{
          id: String(Date.now()),
          product: prd?.name || 'Produit',
          type: 'Entrée',
          quantity,
          date: 'À l’instant',
          author: 'Vous'
        }, ...current]);
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePayCustomerReceivableForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Le versement nécessite une connexion internet.");
      setIsSubmitting(false);
      return;
    }
    const formData = new FormData(event.currentTarget);
    const customerId = formData.get("customer_id") as string;
    const amount = Number(formData.get("amount"));
    const method = formData.get("method") as string;

    const payload = {
      receivable_id: customerId,
      amount: amount,
      payment_method: method,
      idempotency_key: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await payReceivable(payload) as ActionResponse<unknown>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        setCustomers(current => current.map(c => {
          if (c.id === customerId) {
            const newBal = Math.max(0, c.balance - amount);
            return { ...c, balance: newBal, status: newBal > 0 ? 'À relancer' : 'À jour' };
          }
          return c;
        }));
        setModal(null);
      }
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
    const payload = { 
      name: formData.get("name") as string,
      owner_full_name: formData.get("owner_full_name") as string,
      owner_email: formData.get("owner_email") as string,
      owner_password: formData.get("owner_password") as string,
    };
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await createPartnerWorkspace(payload);
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

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Requis : connexion internet.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      full_name: formData.get("full_name") as string,
      role: formData.get("role") as 'seller' | 'manager',
      store_id: formData.get("store_id") as string,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createEmployee(payload);
      if (response && response.error) {
        setErrorMsg(response.error);
      } else {
        setModal(null);
        window.location.reload(); // Refresh to fetch new employees
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Requis : connexion internet.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createSupplier(payload) as ActionResponse<Database['public']['Tables']['suppliers']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        const p = response.data;
        const newSupplier: Supplier = {
          id: p.id, name: p.name, phone: p.phone || '', balance: 0, status: 'À jour'
        };
        setSuppliers(current => [newSupplier, ...current]);
        localStorage.setItem('djelis_suppliers', JSON.stringify([newSupplier, ...suppliers]));
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePaySupplierForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Le règlement nécessite une connexion internet.");
      setIsSubmitting(false);
      return;
    }
    const formData = new FormData(event.currentTarget);
    const supplierId = formData.get("supplier_id") as string;
    const amount = Number(formData.get("amount"));
    const method = formData.get("method") as string;

    const payload = {
      supplier_id: supplierId,
      amount: amount,
      payment_method: method,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || ''
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await paySupplier(payload) as ActionResponse<{ success: true }>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        setSuppliers(current => current.map(s => {
          if (s.id === supplierId) {
            const newBal = Math.max(0, s.balance - amount);
            return { ...s, balance: newBal, status: newBal > 0 ? 'À régler' : 'À jour' };
          }
          return s;
        }));
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline) {
      setErrorMsg("Requis : connexion internet.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      amount: Number(formData.get("amount")),
      reason: formData.get("reason") as string,
      store_id: storeId,
      organization_id: activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || '',
      idempotency_key: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createExpense(payload) as ActionResponse<Database['public']['Tables']['expenses']['Row']>;
      if ('error' in response) {
        setErrorMsg(response.error);
      } else {
        const p = response.data;
        const newTrans: TreasuryTransaction = {
          id: p.id,
          source_table: 'expense',
          net_amount: -p.amount,
          flow_direction: 'out',
          description: p.reason,
          payment_method: 'cash',
          date: 'À l’instant',
          author: 'Vous'
        };
        setTreasuryTransactions(current => [newTrans, ...current]);
        setModal(null);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelMovement(movementId: string) {
    if (!isOnline) {
      alert("Une connexion Internet est requise pour annuler une vente.");
      return;
    }
    
    setIsSubmitting(true);
    const response = await cancelMovement(movementId, activeOrgId || localStorage.getItem('djelis_active_org') || accessibleOrgs[0]?.id || '') as ActionResponse<boolean>;
    setIsSubmitting(false);

    if ('error' in response) {
      alert("Erreur: " + response.error);
    } else {
      alert("La vente a été annulée. Le stock a été restitué.");
      // Soft refresh of the dashboard to reload movements/treasury (simplest way without complex state updates for both arrays)
      window.location.reload();
    }
  }

  return {
    handleSale,
    handleCreateCustomer,
    handleCreateDepot,
    handleCreateProduct,
    handleAddStockMovementForm,
    handlePayCustomerReceivableForm,
    handleCreateClientWorkspaceForm,
    handleCreateEmployee,
    handleCreateSupplier,
    handlePaySupplierForm,
    handleCreateExpense,
    handleCancelMovement
  };
}
