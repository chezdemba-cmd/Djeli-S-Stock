"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "../lib/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";

function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Adresse e-mail non confirmée. Vérifiez votre boîte mail.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse e-mail.";
    case "weak_password":
      return "Mot de passe trop faible (6 caractères minimum).";
    case "email_address_invalid":
      return "Adresse e-mail invalide.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "signup_disabled":
      return "Les inscriptions sont désactivées pour le moment.";
    case "user_banned":
      return "Ce compte a été suspendu.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
    case "over_sms_send_rate_limit": {
      const match = error.message.match(/(\d+)\s*seconds?/i);
      return match
        ? `Pour des raisons de sécurité, veuillez réessayer dans ${match[1]} secondes.`
        : "Trop de tentatives. Veuillez réessayer dans quelques instants.";
    }
    default:
      return error.message;
  }
}

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(translateAuthError(error));
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } else {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        setError(translateAuthError(error));
        setLoading(false);
      } else if (data.session) {
        // Automatically logged in
        router.push("/dashboard");
      } else {
        // Confirmation email sent or logged in depending on settings
        setMessage("Compte créé avec succès. Si une confirmation par e-mail est requise, vérifiez votre boîte mail.");
        setLoading(false);
        // On redirige automatiquement pour forcer la vérification de session (si l'email n'est pas requis)
        setTimeout(() => {
           if (data.session) router.push("/dashboard");
        }, 1500);
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8f5", padding: "20px" }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "18px", boxShadow: "0 12px 24px rgba(23,63,53,.08)", width: "100%", maxWidth: "400px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <Image src="/logo.png" alt="KOMI Logo" width={1024} height={682} style={{ maxWidth: "150px", width: "100%", height: "auto" }} priority />
        </div>
        
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "24px", textAlign: "center", margin: "0 0 10px 0", color: "#173f35" }}>
          {isLogin ? "Connexion" : "Créer un compte"}
        </h1>
        <p style={{ textAlign: "center", color: "#6c7773", fontSize: "14px", margin: "0 0 30px 0" }}>
          {isLogin ? "Accédez à votre espace KOMI" : "Démarrez avec votre propre espace boutique"}
        </p>

        {error && (
          <div style={{ background: "#fae9e7", color: "#b8443a", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", textAlign: "center" }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ background: "#e7f1ed", color: "#173f35", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", textAlign: "center" }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {!isLogin && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#17221f" }}>Nom complet ou Nom de la boutique</label>
              <input 
                type="text" 
                required={!isLogin}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: "100%", height: "46px", padding: "0 14px", borderRadius: "10px", border: "1px solid #dfe2dd", fontSize: "14px", outline: "none" }} 
                placeholder="Ex: Diallo Frères"
              />
            </div>
          )}

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
            <div style={{ position: "relative" }}>
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", height: "46px", padding: "0 40px 0 14px", borderRadius: "10px", border: "1px solid #dfe2dd", fontSize: "14px", outline: "none" }} 
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6c7773", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
            {loading ? <Loader2 className="spin" size={18} /> : (isLogin ? "Se connecter" : "S'inscrire")}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "#6c7773" }}>
          {isLogin ? "Nouveau sur KOMI ?" : "Vous avez déjà un compte ?"}
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
            style={{ 
              background: "none", border: "none", color: "#173f35", fontWeight: "bold", 
              cursor: "pointer", marginLeft: "5px", textDecoration: "underline" 
            }}
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
