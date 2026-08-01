import { useState, useEffect } from 'react';
import type { RispostaStato, RispostaNegozio, Ricompensa, Voucher } from '@backend/domain/types';
import { getStore, redeemReward } from '../api';

interface Props {
  stato: RispostaStato;
  onStateUpdate: (s: RispostaStato) => void;
}

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 20,
  padding: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
};

export default function ShopView({ stato, onStateUpdate }: Props) {
  const { benefit, barra } = stato;
  const [negozio, setNegozio] = useState<RispostaNegozio | null>(null);
  const [toast, setToast] = useState('');
  const [redeemedVoucher, setRedeemedVoucher] = useState<Voucher | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    getStore().then(setNegozio).catch(() => { /* ignore */ });
  }, [barra.gemme]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const handleRedeem = async (item: Ricompensa) => {
    setBuying(item.id);
    try {
      const result = await redeemReward(item.id);
      onStateUpdate(result.stato);
      setNegozio(await getStore());
      setRedeemedVoucher(result.voucher);
      showToast(`${item.nome} redeemed!`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setBuying(null);
    }
  };

  const gems = negozio?.gemme ?? barra.gemme;

  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Shop
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 700, color: '#C9A227' }}>
          <svg width="15" height="15" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="#C9A227" strokeWidth="2" />
            <path d="M12 7v5l3.5 2" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {gems} gems
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

        {toast && (
          <div style={{ background: '#4FA8E8', color: '#21281F', borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
            {toast}
          </div>
        )}

        {/* Redeemed voucher sheet */}
        {redeemedVoucher && (
          <div style={{ background: '#EAF4FC', borderRadius: 20, padding: 18 }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F', marginBottom: 8 }}>
              🎉 {redeemedVoucher.nome}
            </div>
            <div style={{ fontSize: 13, color: '#8A9485', marginBottom: 10 }}>Your voucher code:</div>
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #C7E3F5',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 15,
              fontWeight: 700,
              color: '#21281F',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em',
              marginBottom: 10,
            }}>
              {redeemedVoucher.codice}
            </div>
            <button
              onClick={() => setRedeemedVoucher(null)}
              style={{ width: '100%', background: '#4FA8E8', color: '#21281F', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        )}

        {/* In-app benefits (phase-gated, not purchasable) */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7566', marginBottom: 10 }}>
            In-app benefits
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {benefit.map(b => (
              <div key={b.id} style={CARD}>
                <div style={{
                  width: 38, height: 38,
                  borderRadius: 12,
                  background: b.sbloccato ? '#EAF4FC' : '#F5F6F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}>
                  {b.id === 'grafico-dolore' ? '📈' : '🗓️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{b.nome}</div>
                  <div style={{ fontSize: 12.5, color: '#8A9485', marginTop: 2 }}>{b.descrizione}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: b.sbloccato ? '#3BAB6E' : '#8A9485', marginTop: 4 }}>
                    {b.sbloccato ? '✓ Unlocked' : `Unlocks at phase ${b.faseRichiesta}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gem rewards */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7566', marginBottom: 10 }}>
            Rewards
          </div>
          {!negozio ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A9485', fontSize: 13 }}>Loading…</div>
          ) : negozio.ricompense.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A9485', fontSize: 13 }}>No rewards available yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {negozio.ricompense.map(item => {
                const canAfford = item.acquistabile;
                const isBuying = buying === item.id;
                const isLocked = !item.sbloccato;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: isLocked ? '#F8F9F6' : '#EAF4FC',
                      border: `1px solid ${isLocked ? '#EEF0EA' : '#C7E3F5'}`,
                      borderRadius: 20,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 12,
                      background: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke={isLocked ? '#B3BAA9' : '#1D74B8'} strokeWidth="2" />
                        <path d="M3 10h18M8 6v4M16 6v4" fill="none" stroke={isLocked ? '#B3BAA9' : '#1D74B8'} strokeWidth="2" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>
                        {item.nome}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#6B7566', marginTop: 2 }}>
                        {item.partner} · {item.descrizione}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isLocked ? '#8A9485' : '#1D74B8', marginTop: 4 }}>
                        {isLocked
                          ? `Unlocks at phase ${item.faseRichiesta}`
                          : `${item.costo} gems${item.gemmeMancanti > 0 ? ` · need ${item.gemmeMancanti} more` : ''}`}
                      </div>
                    </div>
                    <button
                      onClick={() => !isLocked && canAfford && handleRedeem(item)}
                      disabled={isLocked || !canAfford || isBuying}
                      style={{
                        flexShrink: 0,
                        background: !isLocked && canAfford ? '#4FA8E8' : '#FFFFFF',
                        color: isLocked ? '#8A9485' : (!canAfford ? '#B3BAA9' : '#21281F'),
                        border: !isLocked && canAfford ? 'none' : '1px solid #E1E4DD',
                        borderRadius: 12,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: canAfford && !isLocked ? 'pointer' : 'default',
                        opacity: isLocked ? 0.6 : 1,
                      }}
                    >
                      {isBuying ? '…' : isLocked ? 'Locked' : canAfford ? 'Redeem' : 'Not enough'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
