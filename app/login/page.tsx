"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Warehouse, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8f5", padding: "20px" }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "18px", boxShadow: "0 12px 24px rgba(23,63,53,.08)", width: "100%", maxWidth: "400px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "60px", height: "60px", background: "#e7f1ed", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", color: "#173f35" }}>
            <Warehouse size={32} />
          </div>
        </div>
        
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "24px", textAlign: "center", margin: "0 0 10px 0", color: "#173f35" }}>Connexion</h1>
        <p style={{ textAlign: "center", color: "#6c7773", fontSize: "14px", margin: "0 0 30px 0" }}>Accédez à votre espace DJELI'S Stock</p>

        {error && (
          <div style={{ background: "#fae9e7", color: "#b8443a", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#17221f" }}>Adresse e-mail</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", height: "46px", padding: "0 14px", borderRadius: "10px", border: "1px solid #dfe2dd", fontSize: "14px", outline: "none" }} 
              placeholder="votre@email.com"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#17221f" }}>Mot de passe</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", height: "46px", padding: "0 14px", borderRadius: "10px", border: "1px solid #dfe2dd", fontSize: "14px", outline: "none" }} 
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: "#173f35", color: "white", border: "none", height: "46px", borderRadius: "10px", 
              fontWeight: "bold", fontSize: "15px", marginTop: "10px", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 className="spin" size={18} /> : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
