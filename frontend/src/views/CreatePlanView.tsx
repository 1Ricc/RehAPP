import { useState, useRef, useCallback } from 'react';
import { createPlan, lookupPlan } from '../api';
import type { PianoCreato } from '@backend/domain/types';

interface Props {
  onBack: () => void;
}

const ACCENT = '#4FA8E8';

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
};

const AREAS = ['Shoulder', 'Knee', 'Ankle'] as const;
type Area = (typeof AREAS)[number];

interface Exercise {
  id: string;
  area: Area;
  name: string;
  desc: string;
}

const LIBRARY: Exercise[] = [
  { id: 'sh1', area: 'Shoulder', name: 'Shoulder Pendulum',   desc: 'Gentle pendulum swings to loosen the shoulder joint' },
  { id: 'sh2', area: 'Shoulder', name: 'Wall Slides',          desc: 'Slide arms up a wall to improve overhead mobility' },
  { id: 'sh3', area: 'Shoulder', name: 'Shoulder Flexion',     desc: 'Raise arm forward and up to rebuild range of motion' },
  { id: 'sh4', area: 'Shoulder', name: 'External Rotation',    desc: 'Rotate forearm outward against light resistance' },
  { id: 'sh5', area: 'Shoulder', name: 'Cross-body Stretch',   desc: 'Pull arm across the chest to stretch the rear shoulder' },
  { id: 'kn1', area: 'Knee',     name: 'Quad Sets',            desc: 'Tighten the thigh with leg straight to activate the quad' },
  { id: 'kn2', area: 'Knee',     name: 'Heel Slides',          desc: 'Slide the heel toward you to regain knee bend' },
  { id: 'kn3', area: 'Knee',     name: 'Straight Leg Raise',   desc: 'Lift a straight leg to strengthen without bending the knee' },
  { id: 'kn4', area: 'Knee',     name: 'Hamstring Curl',       desc: 'Bend the knee to bring your heel toward the glutes' },
  { id: 'kn5', area: 'Knee',     name: 'Terminal Knee Ext.',   desc: 'Straighten the knee fully against band resistance' },
  { id: 'an1', area: 'Ankle',    name: 'Ankle Pumps',          desc: 'Point and flex the foot to boost circulation' },
  { id: 'an2', area: 'Ankle',    name: 'Ankle Circles',        desc: 'Rotate the ankle slowly in both directions' },
  { id: 'an3', area: 'Ankle',    name: 'Calf Raises',          desc: 'Rise onto toes to strengthen calf and ankle' },
  { id: 'an4', area: 'Ankle',    name: 'Resistance Band Eversion', desc: 'Push the foot outward against band tension' },
  { id: 'an5', area: 'Ankle',    name: 'Toe Curls',            desc: 'Scrunch a towel with your toes to build foot strength' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface Selection {
  selected: boolean;
  sets: number;
  reps: number;
  freq: number;
}

type Selections = Record<string, Selection>;

interface Medication {
  id: string;
  name: string;
  days: Record<string, boolean>;
  times: string[];
}

let medCounter = 0;
function newMed(): Medication {
  return {
    id: `med-${++medCounter}`,
    name: '',
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true },
    times: ['08:00'],
  };
}

export default function CreatePlanView({ onBack }: Props) {
  const [label, setLabel] = useState('');
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({
    Mon: true, Tue: false, Wed: true, Thu: false, Fri: true, Sat: false, Sun: false,
  });
  const [weeks, setWeeks] = useState(6);
  const [selections, setSelections] = useState<Selections>(
    Object.fromEntries(LIBRARY.map(e => [e.id, { selected: false, sets: 3, reps: 10, freq: 1 }]))
  );
  const [medications, setMedications] = useState<Medication[]>([]);

  // Load-a-plan state
  const [loadOpen, setLoadOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<PianoCreato | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [savedPlan, setSavedPlan] = useState<PianoCreato | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLookup = async () => {
    // Accept either the bare code or a full URL like "rehapp.com/plan/abc123"
    const code = codeInput.trim().split('/').pop() ?? '';
    if (!code) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      setLookupResult(await lookupPlan(code));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Plan not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const applyPlan = (p: PianoCreato) => {
    setLabel(p.label);
    setWeeks(p.settimane);
    setActiveDays(
      Object.fromEntries(DAYS.map(d => [d, p.giorni.includes(d)]))
    );
    setSelections(prev => {
      const next = { ...prev };
      // Reset all, then mark the ones present in the fetched plan
      for (const key of Object.keys(next)) next[key] = { ...next[key], selected: false };
      for (const e of p.esercizi) {
        if (next[e.id]) next[e.id] = { selected: true, sets: e.serie, reps: e.ripetizioni, freq: e.frequenza };
      }
      return next;
    });
    setMedications(p.farmaci.map(f => ({
      id: `med-${++medCounter}`,
      name: f.nome,
      days: Object.fromEntries(DAYS.map(d => [d, f.giorni.includes(d)])),
      times: f.orari,
    })));
    setLoadOpen(false);
    setLookupResult(null);
    setCodeInput('');
    setSavedPlan(null);
  };

  const addMedication = () => setMedications(prev => [...prev, newMed()]);

  const removeMedication = (id: string) =>
    setMedications(prev => prev.filter(m => m.id !== id));

  const updateMedName = useCallback((id: string, name: string) =>
    setMedications(prev => prev.map(m => m.id === id ? { ...m, name } : m)), []);

  const toggleMedDay = useCallback((id: string, day: string) =>
    setMedications(prev => prev.map(m =>
      m.id === id ? { ...m, days: { ...m.days, [day]: !m.days[day] } } : m
    )), []);

  const updateMedTime = useCallback((id: string, idx: number, value: string) =>
    setMedications(prev => prev.map(m => {
      if (m.id !== id) return m;
      const times = [...m.times];
      times[idx] = value;
      return { ...m, times };
    })), []);

  const addMedTime = useCallback((id: string) =>
    setMedications(prev => prev.map(m =>
      m.id === id ? { ...m, times: [...m.times, '12:00'] } : m
    )), []);

  const removeMedTime = useCallback((id: string, idx: number) =>
    setMedications(prev => prev.map(m => {
      if (m.id !== id || m.times.length <= 1) return m;
      return { ...m, times: m.times.filter((_, i) => i !== idx) };
    })), []);

  const selectedCount = Object.values(selections).filter(s => s.selected).length;

  const toggleDay = (day: string) =>
    setActiveDays(prev => ({ ...prev, [day]: !prev[day] }));

  const toggleExercise = (id: string) =>
    setSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected },
    }));

  const updateField = (id: string, field: keyof Omit<Selection, 'selected'>, value: string) => {
    const n = Math.max(1, parseInt(value) || 1);
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], [field]: n } }));
  };

  const generatePlan = async () => {
    const activeDayList = DAYS.filter(d => activeDays[d]);
    const selectedExercises = LIBRARY
      .filter(e => selections[e.id].selected)
      .map(e => ({
        id: e.id,
        nome: e.name,
        area: e.area,
        serie: selections[e.id].sets,
        ripetizioni: selections[e.id].reps,
        frequenza: selections[e.id].freq,
      }));
    const selectedMeds = medications
      .filter(m => m.name.trim())
      .map(m => ({
        nome: m.name.trim(),
        giorni: DAYS.filter(d => m.days[d]),
        orari: m.times,
      }));

    setSaving(true);
    setSaveError(null);
    setCopied(false);
    try {
      const piano = await createPlan({
        label,
        giorni: activeDayList,
        settimane: weeks,
        esercizi: selectedExercises,
        farmaci: selectedMeds,
      });
      setSavedPlan(piano);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!savedPlan) return;
    const link = `rehapp.com/plan/${savedPlan.shareId}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #EEF0EA' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 18, fontWeight: 700, color: '#6B7566', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Create a Plan
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40, overflowY: 'auto' }}>

        {/* Load a plan */}
        <div style={CARD}>
          <button
            onClick={() => { setLoadOpen(o => !o); setLookupResult(null); setLookupError(null); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4FA8E8' }}>Have a plan code?</div>
            <div style={{ fontSize: 18, color: '#8A9485', transform: loadOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
          </button>

          {loadOpen && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  placeholder="Code or rehapp.com/plan/…"
                  style={{
                    flex: 1,
                    border: '1.5px solid #E7EAE3',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#21281F',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleLookup}
                  disabled={!codeInput.trim() || lookupLoading}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: ACCENT,
                    color: '#21281F',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: codeInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: codeInput.trim() ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  {lookupLoading ? '…' : 'Look up'}
                </button>
              </div>

              {lookupError && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '9px 12px' }}>
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div style={{ background: '#F0F9FF', border: '1.5px solid #B8DCF2', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F', marginBottom: 4 }}>
                    {lookupResult.label || 'Unnamed plan'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 10 }}>
                    {lookupResult.giorni.join(', ')} · {lookupResult.settimane} week{lookupResult.settimane !== 1 ? 's' : ''}
                    {' · '}{lookupResult.esercizi.length} exercise{lookupResult.esercizi.length !== 1 ? 's' : ''}
                    {lookupResult.farmaci.length > 0 ? ` · ${lookupResult.farmaci.length} medication${lookupResult.farmaci.length !== 1 ? 's' : ''}` : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {lookupResult.esercizi.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#21281F', fontWeight: 600 }}>{e.nome}</span>
                        <span style={{ color: '#8A9485' }}>{e.serie}×{e.ripetizioni}</span>
                      </div>
                    ))}
                    {lookupResult.farmaci.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#21281F', fontWeight: 600 }}>{f.nome}</span>
                        <span style={{ color: '#F59E0B' }}>{f.orari.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => applyPlan(lookupResult!)}
                    style={{
                      width: '100%',
                      background: '#2E3A2E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '11px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Use this plan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Label */}
        <div style={CARD}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#6B7566', display: 'block', marginBottom: 8 }}>
            Plan label (optional)
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. For Mom's knee recovery"
            style={{
              width: '100%',
              border: '1.5px solid #E7EAE3',
              borderRadius: 14,
              padding: '12px 14px',
              fontSize: 15,
              fontFamily: 'inherit',
              color: '#21281F',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Schedule */}
        <div style={CARD}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#6B7566', display: 'block', marginBottom: 10 }}>
            Days of the week
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS.map(d => {
              const on = activeDays[d];
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  style={{
                    flex: 1,
                    border: `1.5px solid ${on ? ACCENT : '#E7EAE3'}`,
                    background: on ? ACCENT : '#FAFBF8',
                    color: on ? '#21281F' : '#8A9485',
                    borderRadius: 10,
                    padding: '10px 0',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <label style={{ fontSize: 13, fontWeight: 700, color: '#6B7566', display: 'block', margin: '16px 0 8px' }}>
            Duration (weeks)
          </label>
          <input
            type="number"
            min={1}
            value={weeks}
            onChange={e => setWeeks(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: 80,
              border: '1.5px solid #E7EAE3',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 15,
              fontFamily: 'inherit',
              color: '#21281F',
              outline: 'none',
            }}
          />
        </div>

        {/* Exercise groups */}
        {AREAS.map(area => (
          <div key={area} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7566' }}>
                {area}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LIBRARY.filter(e => e.area === area).map(ex => {
                const sel = selections[ex.id];
                return (
                  <div key={ex.id} style={{ borderRadius: 16, background: '#FAFBF8', padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <button
                        onClick={() => toggleExercise(ex.id)}
                        style={{
                          flexShrink: 0,
                          width: 24, height: 24,
                          borderRadius: 8,
                          border: `2px solid ${sel.selected ? ACCENT : '#D8DCD1'}`,
                          background: sel.selected ? ACCENT : '#FFFFFF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          marginTop: 2,
                        }}
                      >
                        {sel.selected && (
                          <svg width="12" height="12" viewBox="0 0 20 20">
                            <path d="M4 10l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{ex.name}</div>
                        <div style={{ fontSize: 12.5, color: '#8A9485', marginTop: 2 }}>{ex.desc}</div>
                      </div>
                    </div>

                    {sel.selected && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingLeft: 36, flexWrap: 'wrap' }}>
                        <NumField label="Sets" value={sel.sets} onChange={v => updateField(ex.id, 'sets', v)} />
                        <NumField label="Reps" value={sel.reps} onChange={v => updateField(ex.id, 'reps', v)} />
                        <NumField label="Times/day" value={sel.freq} onChange={v => updateField(ex.id, 'freq', v)} width={70} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Medications */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: medications.length > 0 ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: '#6B7566' }}>
                Medications
              </div>
            </div>
            <button
              onClick={addMedication}
              style={{
                width: 30, height: 30,
                borderRadius: 10,
                border: `1.5px solid ${ACCENT}`,
                background: '#EAF4FC',
                color: ACCENT,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>

          {medications.length === 0 && (
            <div style={{ fontSize: 13, color: '#B3BAA9', fontWeight: 600, textAlign: 'center', padding: '8px 0' }}>
              No medications — press + to add one
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {medications.map(med => (
              <div key={med.id} style={{ borderRadius: 16, background: '#FAFBF8', padding: 14 }}>

                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input
                    value={med.name}
                    onChange={e => updateMedName(med.id, e.target.value)}
                    placeholder="Medication name (e.g. Ibuprofen 400mg)"
                    style={{
                      flex: 1,
                      border: '1.5px solid #E7EAE3',
                      borderRadius: 10,
                      padding: '9px 12px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      color: '#21281F',
                      outline: 'none',
                      background: '#FFFFFF',
                    }}
                  />
                  <button
                    onClick={() => removeMedication(med.id)}
                    style={{
                      flexShrink: 0,
                      width: 28, height: 28,
                      borderRadius: 8,
                      border: '1.5px solid #E7EAE3',
                      background: '#FFFFFF',
                      color: '#8A9485',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Day chips */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9485', marginBottom: 6 }}>Days</div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                  {DAYS.map(d => {
                    const on = med.days[d];
                    return (
                      <button
                        key={d}
                        onClick={() => toggleMedDay(med.id, d)}
                        style={{
                          flex: 1,
                          border: `1.5px solid ${on ? ACCENT : '#E7EAE3'}`,
                          background: on ? ACCENT : '#FFFFFF',
                          color: on ? '#21281F' : '#8A9485',
                          borderRadius: 8,
                          padding: '7px 0',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                {/* Times */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9485', marginBottom: 6 }}>Time(s)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {med.times.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="time"
                        value={t}
                        onChange={e => updateMedTime(med.id, idx, e.target.value)}
                        style={{
                          border: '1.5px solid #E7EAE3',
                          borderRadius: 10,
                          padding: '7px 10px',
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          color: '#21281F',
                          outline: 'none',
                          background: '#FFFFFF',
                        }}
                      />
                      {med.times.length > 1 && (
                        <button
                          onClick={() => removeMedTime(med.id, idx)}
                          style={{
                            width: 22, height: 22,
                            borderRadius: 6,
                            border: '1.5px solid #E7EAE3',
                            background: '#FFFFFF',
                            color: '#8A9485',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addMedTime(med.id)}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: `1.5px dashed ${ACCENT}`,
                      background: '#EAF4FC',
                      color: ACCENT,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + time
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generatePlan}
          disabled={selectedCount === 0 || saving || savedPlan !== null}
          style={{
            width: '100%',
            background: savedPlan ? '#3BAB6E' : ACCENT,
            border: 'none',
            borderRadius: 18,
            padding: 18,
            fontFamily: 'Poppins, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#21281F',
            cursor: selectedCount === 0 || saving || savedPlan !== null ? 'not-allowed' : 'pointer',
            boxShadow: savedPlan ? '0 10px 24px rgba(59,171,110,0.3)' : '0 10px 24px rgba(79,168,232,0.3)',
            opacity: selectedCount === 0 && !savedPlan ? 0.5 : 1,
            transition: 'opacity 0.2s, background 0.3s',
          }}
        >
          {saving ? 'Saving…' : savedPlan ? '✓ Plan Generated' : 'Generate Plan'}
        </button>

        {saveError && (
          <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
            {saveError}
          </div>
        )}

        {/* Share card */}
        {savedPlan && (
          <div style={{ background: '#EAF4FC', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1D74B8', marginBottom: 2 }}>
              Plan saved! Share this link:
            </div>
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #C7E3F5',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: '#21281F',
              fontFamily: 'JetBrains Mono, monospace',
              wordBreak: 'break-all',
            }}>
              rehapp.com/plan/{savedPlan.shareId}
            </div>
            <button
              onClick={copyLink}
              style={{
                background: '#2E3A2E',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        )}

      </div>
    </>
  );
}

function NumField({ label, value, onChange, width = 56 }: { label: string; value: number; onChange: (v: string) => void; width?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#8A9485' }}>{label}</label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width,
          border: '1.5px solid #E7EAE3',
          borderRadius: 10,
          padding: '8px 10px',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          color: '#21281F',
        }}
      />
    </div>
  );
}
