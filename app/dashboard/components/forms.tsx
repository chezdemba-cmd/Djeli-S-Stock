import { useState, FormEvent, useEffect } from "react";
import { Product, Customer, Supplier, Depot } from "../types";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useOffline } from "../../providers/OfflineProvider";
import {
  ShoppingCart,
  Boxes,
  ArrowDownLeft,
  CircleDollarSign,
  Users,
  Truck,
  Store,
  Warehouse,
  UserPlus,
} from "lucide-react";

export function SaleForm({
  products,
  customers,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  products: Product[];
  customers: Customer[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  const { isOnline } = useOffline();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [paid, setPaid] = useState(0);

  const [scanning, setScanning] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");

  useEffect(() => {
    if (scanning) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        scanner.clear();
        setScanning(false);
        const p = products.find(prod => prod.sku === decodedText);
        if (p) {
          setSelectedProduct(p.id);
          setPaid(p.salePrice * qty);
        } else {
          alert("Produit non trouvé avec ce code-barres.");
        }
      }, (error) => {
        // ignore error
      });
      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [scanning, products, qty]);

  // Handle physical scanner (typing fast)
  useEffect(() => {
    if (barcodeInput.length > 5) {
      const p = products.find(prod => prod.sku === barcodeInput);
      if (p) {
        setSelectedProduct(p.id);
        setPaid(p.salePrice * qty);
        setBarcodeInput(""); // clear
      }
    }
  }, [barcodeInput, products, qty]);


  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
  const product = products.find((p) => p.id === selectedProduct);
  const total = product ? product.salePrice * qty : 0;

  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <ShoppingCart />
        </div>
        <div>
          <h2>Nouvelle Vente</h2>
          <p>Enregistrez une transaction manuelle.</p>
        </div>
      </div>
      {!isOnline && (
        <div
          className="alert-warning"
          style={{
            background: "#fff3e0",
            color: "#e65100",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          Vous êtes hors ligne. La vente sera synchronisée au retour du réseau.
        </div>
      )}
      {errorMsg && (
        <div
          className="alert-error"
          style={{
            color: "red",
            marginBottom: "1rem",
            background: "#ffebee",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          {errorMsg}
        </div>
      )}
      
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <input 
          type="text" 
          placeholder="Code-barres (douchette)..." 
          value={barcodeInput} 
          onChange={(e) => setBarcodeInput(e.target.value)} 
          autoFocus
          style={{ flex: 1, padding: "8px" }}
        />
        <button type="button" onClick={() => setScanning(!scanning)} className="button-secondary">
          {scanning ? "Fermer Caméra" : "Scanner (Caméra)"}
        </button>
      </div>
      {scanning && <div id="reader" style={{ width: "100%", marginBottom: "1rem" }}></div>}
      <form onSubmit={onSubmit}>

        <label className="wide">
          Produit
          <select
            name="product"
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              setPaid(products.find((p) => p.id === e.target.value)!.salePrice * qty);
            }}
            required
          >
            <option value="" disabled>
              Sélectionner un produit...
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.quantity} dispo — {money.format(p.salePrice)}/u
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Quantité{" "}
            <input
              name="quantity"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQty(q);
                setPaid(product ? product.salePrice * q : 0);
              }}
              required
            />
          </label>
          <label>
            Total (FCFA){" "}
            <input
              type="text"
              value={money.format(total)}
              disabled
              style={{ background: "#f5f5f5", fontWeight: "bold" }}
            />
          </label>
        </div>
        <label className="wide">
          Client (Facultatif si comptant)
          <select name="customer_id">
            <option value="">Aucun client spécifique (Vente de passage)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Moyen de paiement
            <select name="method">
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement Bancaire</option>
            </select>
          </label>
          <label>
            Montant encaissé{" "}
            <input
              name="paid_amount"
              type="number"
              min="0"
              max={total}
              value={paid}
              onChange={(e) => setPaid(Number(e.target.value))}
              required
            />
          </label>
        </div>
        {paid < total && (
          <p style={{ gridColumn: "1 / -1", color: "#e65100", fontSize: "0.9rem", marginTop: "-0.5rem" }}>
            Reste à payer : {money.format(total - paid)} (Crédit)
          </p>
        )}

        <div className="form-actions wide">
          <button
            type="button"
            onClick={() => document.querySelector(".modal-close")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))}
          >
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting || !product}>
            {isSubmitting ? "Validation..." : "Valider la vente"}
          </button>
        </div>
      </form>
    </>
  );
}

export function ProductForm({
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <Boxes />
        </div>
        <div>
          <h2>Nouveau Produit</h2>
          <p>Ajouter une référence au catalogue.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
                <label className="wide">
          Code-barres / SKU (Optionnel) <input type="text" name="sku" placeholder="Laissez vide pour auto-générer" />
        </label>
        <label className="wide">
          Nom du produit <input required type="text" name="name" placeholder="Ex: Riz Parfumé 25kg" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Catégorie <input required type="text" name="category" placeholder="Ex: Céréales" defaultValue="Général" />
          </label>
          <label>
            Unité <input required type="text" name="unit" placeholder="Ex: Sac, Kg, Carton" defaultValue="Sac" />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Prix d'Achat (FCFA) <input required type="number" min="0" name="purchase_price" defaultValue="15000" />
          </label>
          <label>
            Prix de Vente (FCFA) <input required type="number" min="0" name="sale_price" defaultValue="18000" />
          </label>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}
          className="wide"
        >
          <label>
            Stock Initial <input type="number" min="0" name="initial_quantity" defaultValue="0" />
          </label>
          <label>
            Alerte Stock Min. <input type="number" min="0" name="min_stock" defaultValue="5" />
          </label>
        </div>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer le produit"}
          </button>
        </div>
      </form>
    </>
  );
}

export function StockInflowForm({
  products,
  suppliers,
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  products: Product[];
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [hasSupplier, setHasSupplier] = useState(false);
  const [payableAmount, setPayableAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <ArrowDownLeft />
        </div>
        <div>
          <h2>Entrée de Stock / Arrivage</h2>
          <p>Enregistrer une livraison de marchandises.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Produit livré
          <select
            name="product_id"
            required
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="" disabled>
              Sélectionner un produit...
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Stock actuel: {p.quantity})
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Quantité reçue
          <input
            required
            type="number"
            min="1"
            name="quantity"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>

        <label
          className="wide"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: "normal",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          <input type="checkbox" checked={hasSupplier} onChange={(e) => setHasSupplier(e.target.checked)} /> Lier à un
          fournisseur (Achat)
        </label>

        {hasSupplier && (
          <div style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px", marginTop: "0.5rem" }}>
            <label className="wide">
              Fournisseur
              <select name="supplier_id" required>
                <option value="" disabled>
                  Sélectionner un fournisseur...
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
              <label>
                Montant total de la facture (FCFA)
                <input
                  type="number"
                  min="0"
                  name="payable_amount"
                  required
                  value={payableAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPayableAmount(val);
                    if (amountPaid > val) setAmountPaid(val);
                  }}
                />
              </label>
              <label>
                Montant payé immédiatement (FCFA)
                <input
                  type="number"
                  min="0"
                  max={payableAmount}
                  name="amount_paid"
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                />
              </label>
            </div>
            {amountPaid < payableAmount && (
              <p style={{ color: "#e65100", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Reste à payer : {money.format(payableAmount - amountPaid)} (Sera ajouté à la dette fournisseur)
              </p>
            )}
          </div>
        )}

        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Valider l'Arrivage"}
          </button>
        </div>
      </form>
    </>
  );
}

export function PaymentForm({
  customer,
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
  money,
}: {
  customer: Customer;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
  money: Intl.NumberFormat;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <CircleDollarSign />
        </div>
        <div>
          <h2>Règlement de Créance</h2>
          <p>Paiement pour {customer.name}</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <div
        style={{
          background: "#fff8e1",
          borderLeft: "4px solid #ffa000",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#5D4037" }}>Dette totale enregistrée :</p>
        <strong style={{ fontSize: "1.2rem", color: "#d32f2f" }}>{money.format(customer.balance)}</strong>
      </div>
      <form onSubmit={onSubmit}>
        <input type="hidden" name="customer_id" value={customer.id} />
        <label className="wide">
          Montant versé (FCFA)
          <input required type="number" min="1" max={customer.balance} name="amount" defaultValue={customer.balance} />
        </label>
        <label className="wide">
          Moyen de paiement
          <select name="method" defaultValue="cash">
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement Bancaire</option>
          </select>
        </label>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Validation..." : "Enregistrer le versement"}
          </button>
        </div>
      </form>
    </>
  );
}

export function CustomerForm({
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <Users />
        </div>
        <div>
          <h2>Nouveau Client</h2>
          <p>Ajouter un client à la base.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Nom du client <input required type="text" name="name" placeholder="Ex: Boutique Diallo" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Téléphone <input type="tel" name="phone" placeholder="Ex: 01 23 45 67 89" />
          </label>
          <label>
            Ville <input type="text" name="city" placeholder="Ex: Bamako" />
          </label>
        </div>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Ajouter le client"}
          </button>
        </div>
      </form>
    </>
  );
}

export function SupplierForm({
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <Truck />
        </div>
        <div>
          <h2>Nouveau Fournisseur</h2>
          <p>Ajouter un fournisseur pour vos arrivages.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Nom du fournisseur <input required type="text" name="name" placeholder="Ex: Grossiste ABC" />
        </label>
        <label className="wide">
          Téléphone <input type="tel" name="phone" placeholder="Ex: 01 23 45 67 89" />
        </label>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Ajouter le fournisseur"}
          </button>
        </div>
      </form>
    </>
  );
}

export function PaySupplierForm({
  supplier,
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
  money,
}: {
  supplier: Supplier;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
  money: Intl.NumberFormat;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <CircleDollarSign />
        </div>
        <div>
          <h2>Règlement Fournisseur</h2>
          <p>Paiement pour {supplier.name}</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <div
        style={{
          background: "#fff8e1",
          borderLeft: "4px solid #ffa000",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#5D4037" }}>Dette totale envers ce fournisseur :</p>
        <strong style={{ fontSize: "1.2rem", color: "#d32f2f" }}>{money.format(supplier.balance)}</strong>
      </div>
      <form onSubmit={onSubmit}>
        <input type="hidden" name="supplier_id" value={supplier.id} />
        <label className="wide">
          Montant versé (FCFA)
          <input required type="number" min="1" max={supplier.balance} name="amount" defaultValue={supplier.balance} />
        </label>
        <label className="wide">
          Moyen de paiement
          <select name="method" defaultValue="cash">
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement Bancaire</option>
          </select>
        </label>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Validation..." : "Enregistrer le décaissement"}
          </button>
        </div>
      </form>
    </>
  );
}

export function DepotForm({
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <Store />
        </div>
        <div>
          <h2>Nouvelle Boutique</h2>
          <p>Ajouter une nouvelle boutique ou succursale.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Nom du dépôt <input required type="text" name="name" placeholder="Ex: Magasin Central" />
        </label>
        <label className="wide">
          Ville <input type="text" name="city" placeholder="Ex: Bamako" />
        </label>
        <label
          className="wide"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "normal", cursor: "pointer" }}
        >
          <input type="checkbox" name="allow_negative_stock" /> Autoriser le stock négatif (Vente sans stock préalable)
        </label>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Ajouter le dépôt"}
          </button>
        </div>
      </form>
    </>
  );
}

export function ClientForm({
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <Warehouse />
        </div>
        <div>
          <h2>Nouvelle Entreprise / Organisation</h2>
          <p>Créer une entreprise et son dépôt principal par défaut.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Nom de l'entreprise ou boutique
          <input name="name" required type="text" placeholder="Ex: Ma Boutique Bamako" />
        </label>
        <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Cette entreprise sera immédiatement créée avec son Dépôt Principal.
        </p>
        <div className="form-actions wide">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Créer l'Entreprise"}
          </button>
        </div>
      </form>
    </>
  );
}

export function EmployeeForm({
  depots,
  onClose,
  onSubmit,
  isSubmitting,
  errorMsg,
}: {
  depots: Depot[];
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  return (
    <>
      <div className="modal-heading">
        <div className="modal-symbol">
          <UserPlus />
        </div>
        <div>
          <h2>Ajouter un employé</h2>
          <p>Le mot de passe initial sera requis pour sa connexion.</p>
        </div>
      </div>
      {errorMsg && (
        <div
          className="alert-error"
          style={{ color: "red", marginBottom: "1rem", background: "#ffebee", padding: "10px", borderRadius: "8px" }}
        >
          {errorMsg}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label className="wide">
          Nom complet <input name="full_name" required type="text" placeholder="Ex: Aminata Traoré" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Adresse e-mail <input name="email" required type="email" placeholder="aminata@exemple.com" />
          </label>
          <label>
            Mot de passe initial{" "}
            <input name="password" required type="password" minLength={6} placeholder="••••••••" />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="wide">
          <label>
            Rôle
            <select name="role" required defaultValue="seller">
              <option value="seller">Caissier / Vendeur</option>
              <option value="manager">Gérant</option>
            </select>
          </label>
          <label>
            Dépôt assigné
            <select name="store_id" required>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions wide" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Ajouter l'employé"}
          </button>
        </div>
      </form>
    </>
  );
}

export function ExpenseForm({ onClose, onSubmit, isSubmitting, errorMsg }: { onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; isSubmitting: boolean; errorMsg: string | null; }) {
  return (
    <div className="modal-body">
      <h2>Nouvelle D�pense</h2>
      {errorMsg && <div className="alert-error">{errorMsg}</div>}
      <form onSubmit={onSubmit}>
        <label className="wide">Motif <input name="reason" type="text" required placeholder="Ex: Facture �lectricit�" /></label>
        <label className="wide">Montant (FCFA) <input name="amount" type="number" required min="1" /></label>
        <div className="form-actions wide" style={{ marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Annuler</button>
          <button className="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Validation...' : 'Valider'}</button>
        </div>
      </form>
    </div>
  );
}
