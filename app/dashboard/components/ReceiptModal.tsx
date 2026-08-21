import React, { useRef, useState } from "react";
import { ShoppingCart, Download, Share2, Printer } from "lucide-react";
import { Receipt } from "../types";
import html2canvas from "html2canvas";

export function ReceiptModal({ receipt, money }: { receipt: Receipt; money: Intl.NumberFormat }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const greeting = `Bonjour cher(e) client(e) 👋`;
  const text = `${greeting}\n\nMerci pour votre achat chez *DJELI'S STOCK* !\nVoici les détails de votre facture du ${receipt.date} :\n\n🛍️ *${receipt.quantity}x ${receipt.productName}*\n💰 *Total : ${money.format(receipt.total)}*\n💵 Payé : ${money.format(receipt.paid)}\n📝 Reste à payer : ${money.format(receipt.due)}\n\nMerci de votre confiance et à très bientôt ! 🙏`;
  
  const phoneParam = receipt.customerPhone ? receipt.customerPhone.replace(/[^0-9]/g, "") : "";
  const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;

  const handlePrint = (type: "ticket" | "a4") => {
    document.body.classList.add(`print-${type}`);
    window.print();
    setTimeout(() => {
      document.body.classList.remove(`print-${type}`);
    }, 1000);
  };

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    
    try {
      const element = receiptRef.current;
      element.style.position = 'static';
      element.style.left = 'auto';
      
      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      
      element.style.position = 'absolute';
      element.style.left = '-9999px';

      const image = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement("a");
      link.href = image;
      link.download = `Facture_Djeli_${receipt.date.replace(/[\/ :]/g, "")}.jpg`;
      link.click();
    } catch (err) {
      console.error("Erreur génération image", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="modal-heading dont-print">
        <div className="modal-symbol">
          <ShoppingCart />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div>
            <h2>Facture Finalisée</h2>
            <p>Envoyez une copie professionnelle à votre client.</p>
          </div>
        </div>
      </div>

      {/* Reçu Invisible (utilisé pour la photo) */}
      <div style={{ overflow: 'hidden', height: 0 }} className="dont-print">
        <div 
          ref={receiptRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '400px',
            background: 'white',
            color: '#111',
            padding: '40px 30px',
            fontFamily: '"Inter", sans-serif',
            boxSizing: 'border-box',
            borderBottom: '4px dashed #ddd',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            background: '#1a1a2e',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '15px'
          }}>
             <ShoppingCart color="white" size={30} />
          </div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#1a1a2e' }}>DJELI'S STOCK</h2>
          <p style={{ margin: '0 0 25px 0', fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Reçu de Paiement</p>
          
          <div style={{ width: '100%', borderBottom: '1px solid #eee', marginBottom: '20px' }}></div>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#888' }}>Date</span>
              <span style={{ fontWeight: '500' }}>{receipt.date}</span>
            </div>
            {receipt.customerPhone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#888' }}>Client (Tél)</span>
                <span style={{ fontWeight: '500' }}>{receipt.customerPhone}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#888' }}>Produit</span>
              <span style={{ fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{receipt.productName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#888' }}>Quantité</span>
              <span style={{ fontWeight: '500' }}>{receipt.quantity}</span>
            </div>
          </div>
          
          <div style={{ 
            width: '100%', 
            background: '#f8f9fa', 
            borderRadius: '12px', 
            padding: '20px', 
            boxSizing: 'border-box',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '700', color: '#1a1a2e' }}>
              <span>Total</span>
              <span>{money.format(receipt.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#666' }}>Payé</span>
              <span style={{ color: '#27ae60', fontWeight: '600' }}>{money.format(receipt.paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#666' }}>Reste à payer</span>
              <span style={{ color: receipt.due > 0 ? '#e74c3c' : '#666', fontWeight: '600' }}>{money.format(receipt.due)}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ 
              height: '40px', 
              width: '200px', 
              background: 'repeating-linear-gradient(90deg, #111, #111 2px, transparent 2px, transparent 4px, #111 4px, #111 5px, transparent 5px, transparent 8px, #111 8px, #111 12px, transparent 12px, transparent 14px)' 
            }}></div>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#888', letterSpacing: '4px' }}>MERCI POUR VOTRE VISITE</p>
          </div>
        </div>
      </div>

      <div className="printable-receipt">
        <div className="receipt-header">
          <h2>DJELI'S STOCK</h2>
          <p>Reçu de Vente</p>
          <p>Date : {receipt.date}</p>
        </div>
        <div className="receipt-body">
          <div className="receipt-item">
            <span>{receipt.quantity}x {receipt.productName}</span>
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
            <span>Reste :</span>
            <span>{money.format(receipt.due)}</span>
          </div>
        </div>
        <div className="receipt-footer">
          <p>Merci pour votre confiance !</p>
        </div>
      </div>

      <div className="form-actions dont-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "20px" }}>
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleDownloadImage}
          className="button primary"
          style={{ background: "#6c5ce7", display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", gridColumn: "1 / -1", width: "100%", padding: "12px" }}
        >
          {isGenerating ? "Génération de l'image..." : <><Download size={18} /> Télécharger la photo du Reçu</>}
        </button>
        
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="button"
          style={{
            background: "#25D366", color: "white", display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", gridColumn: "1 / -1", textDecoration: "none", padding: "12px"
          }}
        >
          <Share2 size={18} /> Envoyer par WhatsApp
        </a>

        <button
          type="button"
          onClick={() => handlePrint("ticket")}
          className="button-secondary"
          style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", fontSize: "13px", padding: "10px" }}
        >
          <Printer size={16} /> Ticket 80mm
        </button>
        <button
          type="button"
          onClick={() => handlePrint("a4")}
          className="button-secondary"
          style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", fontSize: "13px", padding: "10px" }}
        >
          <Printer size={16} /> Facture A4
        </button>
      </div>
    </>
  );
}
