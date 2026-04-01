import React, { useRef } from 'react';

/**
 * FigmaCard: Réplica do design premium para compartilhamento social.
 * Inspirado no estilo da Cednet Provedor.
 */
const FigmaCard = ({ data, label }) => {
  const cardRef = useRef(null);

  if (!data) return null;

  const { metrics } = data;
  const sla = metrics.sla?.global?.met || '0%';
  const volume = metrics.volume?.total || 0;
  const mttr = metrics.mttr?.global?.avg || '0h';

  return (
    <div 
      ref={cardRef}
      id="figma-social-card"
      style={{
        width: '500px',
        height: '500px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '32px',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* Background Decorativo */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        right: '-100px',
        width: '300px',
        height: '300px',
        background: 'rgba(79, 70, 229, 0.05)',
        borderRadius: '50%',
        zIndex: 0
      }} />

      {/* Header */}
      <div style={{ zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            background: '#4f46e5', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>C</div>
          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '18px' }}>NOC CEDNET</span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', margin: 0, lineHeight: 1.1 }}>
          Resultados <br/>
          <span style={{ color: '#4f46e5' }}>{label.replace(/_/g, ' ')}</span>
        </h1>
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px', 
        zIndex: 1 
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>SLA Global</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981' }}>{sla}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Volume</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#4f46e5' }}>{volume}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Tempo Médio (MTTR)</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#334155' }}>{mttr}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderTop: '1px solid #cbd5e1',
        paddingTop: '16px',
        zIndex: 1
      }}>
        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Relatório Gerado Automaticamente</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4f46e5' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
        </div>
      </div>
    </div>
  );
};

export default FigmaCard;
