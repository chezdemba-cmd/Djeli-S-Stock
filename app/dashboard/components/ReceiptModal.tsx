import { ShoppingCart } from "lucide-react";
import { Receipt } from "../types";

export function ReceiptModal({ receipt, money }: { receipt: Receipt; money: Intl.NumberFormat }) {
  const text = `*DJELI'S STOCK - REÇU DE VENTE* 🧾\nDate : ${receipt.date}\n-------------------------\nProduit : ${receipt.quantity}x ${receipt.productName}\nTotal : ${money.format(receipt.total)}\nPayé : ${money.format(receipt.paid)}\nReste à Payer : ${money.format(receipt.due)}\n-------------------------\nMerci pour votre confiance !`;
  const phoneParam = receipt.customerPhone ? receipt.customerPhone.replace(/[^0-9]/g, "") : "";
  const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;

  const handlePrint = (type: "ticket" | "a4") => {
    document.body.classList.add(`print-${type}`);
    window.print();
    setTimeout(() => {
      document.body.classList.remove(`print-${type}`);
    }, 1000);
  };

  return (
    <>
      <div className="modal-heading dont-print">
        <div className="modal-symbol">
          <ShoppingCart />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div>
            <h2>Reçu</h2>
            <p>Imprimer ou Partager</p>
          </div>
        </div>
      </div>

      <pre
        className="dont-print"
        style={{
          background: "#f5f5f5",
          padding: "15px",
          borderRadius: "8px",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
          marginBottom: "1rem",
        }}
      >
        {text}
      </pre>

      <div className="printable-receipt">
        <div className="receipt-header">
          <h2>DJELI&apos;S STOCK</h2>
          <p>Reçu de Vente</p>
          <p>Date : {receipt.date}</p>
        </div>
        <div className="receipt-body">
          <div className="receipt-item">
            <span>
              {receipt.quantity}x {receipt.productName}
            </span>
          </div>
        </div>
        <div className="receipt-totals">
          <div className="receipt-row bold">
            <span>Total :</span>
            <span>{money.format(receipt.total)}</span>
          </div>
          <div className="receipt-row">
            <span>Payé :</span>
            <span>{money.format(receipt.paid)}</span>
          </div>
          <div className="receipt-row highlight">
            <span>Reste à Payer :</span>
            <span>{money.format(receipt.due)}</span>
          </div>
        </div>
        <div className="receipt-footer">
          <p>Merci pour votre confiance !</p>
        </div>
      </div>

      <div className="form-actions wide dont-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handlePrint("ticket")}
          style={{ background: "#e7f1ed", color: "#173f35", flex: 1, padding: "10px 5px", fontSize: "12px" }}
        >
          🖨️ Ticket 80mm
        </button>
        <button
          type="button"
          onClick={() => handlePrint("a4")}
          style={{ background: "#e7f1ed", color: "#173f35", flex: 1, padding: "10px 5px", fontSize: "12px" }}
        >
          🖨️ Facture A4
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="button primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            flex: 1,
            padding: "10px 5px",
            fontSize: "12px",
          }}
        >
          📱 WhatsApp
        </a>
      </div>
    </>
  );
}
