const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
  textAlign: 'center',
};

export default function CreatePlanView() {
  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0EA' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Create a Plan
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>
        <div style={CARD}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏗️</div>
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, color: '#21281F', marginBottom: 8 }}>
            Coming soon
          </div>
          <div style={{ fontSize: 14, color: '#8A9485', lineHeight: 1.6 }}>
            Plan creation is in the works. Soon you'll be able to build custom rehab plans and share them with a link.
          </div>
        </div>
      </div>
    </>
  );
}
