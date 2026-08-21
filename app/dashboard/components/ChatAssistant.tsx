import React, { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { X, Send, Sparkles, User, Bot } from 'lucide-react';

interface ChatAssistantProps {
  context: any;
}

export function ChatAssistant({ context }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: {
      context
    }
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#6c5ce7',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Comy IA"
      >
        <Sparkles size={24} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '350px',
          height: '500px',
          backgroundColor: '#1a1a2e',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
          border: '1px solid #333'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#6c5ce7',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} />
              <strong style={{ fontSize: '1.1rem' }}>Comy IA</strong>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#16213e'
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                <Bot size={40} style={{ margin: '0 auto', opacity: 0.5, marginBottom: '10px' }} />
                <p>Bonjour ! Je suis Comy IA. Posez-moi des questions sur vos stocks, vos ventes ou vos finances.</p>
              </div>
            )}
            {messages.map((m: any) => (
              <div key={m.id} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? '#6c5ce7' : '#0f3460',
                color: 'white',
                padding: '10px 14px',
                borderRadius: '12px',
                maxWidth: '85%',
                fontSize: '0.9rem',
                lineHeight: '1.4'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', opacity: 0.7, fontSize: '0.8rem' }}>
                  {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  <span>{m.role === 'user' ? 'Vous' : 'Comy IA'}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', color: '#888', fontSize: '0.8rem', padding: '8px' }}>
                Comy IA réfléchit...
              </div>
            )}
            {error && (
              <div style={{ alignSelf: 'center', color: '#e74c3c', fontSize: '0.8rem', padding: '8px', textAlign: 'center' }}>
                Erreur de connexion. Vérifiez votre clé API Google.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={{
            padding: '12px',
            backgroundColor: '#1a1a2e',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: '8px'
          }}>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Posez votre question..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '20px',
                border: '1px solid #444',
                backgroundColor: '#16213e',
                color: 'white',
                outline: 'none'
              }}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              style={{
                backgroundColor: '#6c5ce7',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !input.trim()) ? 0.5 : 1
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
