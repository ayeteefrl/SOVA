'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Chip } from '@/components/ui/Chip';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';
import { createPortal } from 'react-dom';


type Property = {
  id: string;
  name: string;
  property_type: string;
  location?: string;
  purchase_price: number;
  current_value: number;
  rental_yield: number;
  area?: number;
  area_unit?: string;
  purchase_date?: string;
  emi: number;
  loan_outstanding: number;
  tenant_name?: string;
  lease_expiry?: string;
  floors?: string;
  facing?: string;
  last_valuation_date?: string;
};

const TYPE_COLORS: Record<string, string> = {
  Residential: '#adc6ff',
  Commercial: '#4edea3',
  Land: '#D4AF37',
  Industrial: '#ffb2b7',
  Other: '#8b9dff',
};

function PropertyGraphic({ type, color }: { type: string; color: string }) {
  if (type === 'Residential') {
    return (
      <svg viewBox="0 0 120 80" className="w-full h-full" fill="none">
        <rect x="20" y="40" width="80" height="35" rx="2" fill={`${color}18`} stroke={`${color}30`} strokeWidth="1" />
        <polygon points="60,10 15,42 105,42" fill={`${color}12`} stroke={`${color}30`} strokeWidth="1" />
        <rect x="46" y="52" width="15" height="23" rx="1" fill={`${color}25`} />
        <rect x="68" y="50" width="18" height="13" rx="1" fill={`${color}20`} />
        <rect x="22" y="50" width="18" height="13" rx="1" fill={`${color}20`} />
      </svg>
    );
  }
  if (type === 'Commercial') {
    return (
      <svg viewBox="0 0 120 80" className="w-full h-full" fill="none">
        <rect x="30" y="12" width="60" height="63" rx="2" fill={`${color}18`} stroke={`${color}30`} strokeWidth="1" />
        {[18, 26, 34, 42, 50, 58].map((y) => (
          <g key={y}>{[35, 47, 59, 71].map((x) => (
            <rect key={x} x={x} y={y} width="8" height="5" rx="0.5" fill={`${color}20`} />
          ))}</g>
        ))}
        <rect x="50" y="63" width="20" height="12" rx="1" fill={`${color}25`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none">
      <path d="M10 65 Q30 45 50 55 Q70 65 90 48 Q105 38 115 50 L115 72 L10 72 Z" fill={`${color}18`} stroke={`${color}25`} strokeWidth="1" />
      <rect x="18" y="38" width="82" height="30" stroke={`${color}25`} strokeWidth="0.8" strokeDasharray="4 3" fill="none" />
    </svg>
  );
}

/* ── Shared style helpers ─────────────────────────────────────────── */
const inputCls = 'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all';
const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';

/* ── Edit Property Modal ─────────────────────────────────────────── */
function EditPropertyModal({
  property,
  onClose,
  onSave,
}: {
  property: Property;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Property>) => void;
}) {
  const [form, setForm] = useState({
    name: property.name,
    property_type: property.property_type,
    location: property.location ?? '',
    purchase_price: String(property.purchase_price),
    current_value: String(property.current_value),
    rental_yield: String(property.rental_yield),
    area: property.area ? String(property.area) : '',
    area_unit: property.area_unit ?? 'sqft',
    purchase_date: property.purchase_date ?? '',
    emi: String(property.emi),
    loan_outstanding: String(property.loan_outstanding),
    tenant_name: property.tenant_name ?? '',
    lease_expiry: property.lease_expiry ?? '',
    floors: property.floors ?? '',
    facing: property.facing ?? '',
  });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const fields: { key: keyof typeof form; label: string; type?: string; placeholder?: string; full?: boolean; options?: string[] }[] = [
    { key: 'name', label: 'Property Name *', placeholder: 'e.g. Flat 4B, Prestige Park', full: true },
    { key: 'property_type', label: 'Type', options: ['Residential', 'Commercial', 'Land', 'Industrial', 'Other'] },
    { key: 'location', label: 'Location', placeholder: 'e.g. Bandra, Mumbai' },
    { key: 'purchase_price', label: 'Purchase Price (₹)', type: 'number', placeholder: '7500000' },
    { key: 'current_value', label: 'Current Value (₹)', type: 'number', placeholder: '9500000' },
    { key: 'rental_yield', label: 'Rental Yield (%)', type: 'number', placeholder: '3.5' },
    { key: 'area', label: 'Area', type: 'number', placeholder: '1200' },
    { key: 'area_unit', label: 'Unit', options: ['sqft', 'sqm', 'acres', 'guntha'] },
    { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
    { key: 'emi', label: 'Monthly EMI (₹)', type: 'number', placeholder: '45000' },
    { key: 'loan_outstanding', label: 'Loan Outstanding (₹)', type: 'number', placeholder: '3500000' },
    { key: 'tenant_name', label: 'Tenant / Use', placeholder: 'Own use / Tenant name' },
    { key: 'lease_expiry', label: 'Lease Expiry', placeholder: 'e.g. Dec 2026' },
    { key: 'floors', label: 'Floor / Location Info', placeholder: '4th Floor, Tower B' },
    { key: 'facing', label: 'Facing', placeholder: 'North-East' },
  ];

  function submit() {
    if (!form.name) return;
    onSave(property.id, {
      name: form.name,
      property_type: form.property_type,
      location: form.location || undefined,
      purchase_price: Number(form.purchase_price) || 0,
      current_value: Number(form.current_value) || 0,
      rental_yield: Number(form.rental_yield) || 0,
      area: form.area ? Number(form.area) : undefined,
      area_unit: form.area_unit,
      purchase_date: form.purchase_date || undefined,
      emi: Number(form.emi) || 0,
      loan_outstanding: Number(form.loan_outstanding) || 0,
      tenant_name: form.tenant_name || undefined,
      lease_expiry: form.lease_expiry || undefined,
      floors: form.floors || undefined,
      facing: form.facing || undefined,
    });
    onClose();
  }

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#adc6ff] text-xl">edit</span>
              Edit Property
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">{property.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                <label className={labelCls}>{f.label}</label>
                {f.options ? (
                  <select
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls + ' [color-scheme:dark]'}
                    style={inputStyle}
                  >
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls + (f.type === 'date' ? ' [color-scheme:dark]' : '')}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={!form.name}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}>
              <span className="material-symbols-outlined text-sm">check</span>
              Save Property
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

function AddPropertyModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Partial<Property>) => void }) {
  const [form, setForm] = useState({
    name: '', property_type: 'Residential', location: '', purchase_price: '',
    current_value: '', rental_yield: '', area: '', area_unit: 'sqft',
    purchase_date: '', emi: '', loan_outstanding: '', tenant_name: '',
    lease_expiry: '', floors: '', facing: '',
  });

  function submit() {
    if (!form.name) return;
    onSave({
      name: form.name,
      property_type: form.property_type,
      location: form.location || undefined,
      purchase_price: Number(form.purchase_price) || 0,
      current_value: Number(form.current_value) || 0,
      rental_yield: Number(form.rental_yield) || 0,
      area: form.area ? Number(form.area) : undefined,
      area_unit: form.area_unit,
      purchase_date: form.purchase_date || undefined,
      emi: Number(form.emi) || 0,
      loan_outstanding: Number(form.loan_outstanding) || 0,
      tenant_name: form.tenant_name || undefined,
      lease_expiry: form.lease_expiry || undefined,
      floors: form.floors || undefined,
      facing: form.facing || undefined,
    });
    onClose();
  }

  const fields: { key: keyof typeof form; label: string; type?: string; placeholder?: string; full?: boolean; options?: string[] }[] = [
    { key: 'name', label: 'Property Name *', placeholder: 'e.g. Flat 4B, Prestige Park', full: true },
    { key: 'property_type', label: 'Type', options: ['Residential', 'Commercial', 'Land', 'Industrial', 'Other'] },
    { key: 'location', label: 'Location', placeholder: 'e.g. Bandra, Mumbai' },
    { key: 'purchase_price', label: 'Purchase Price (₹)', type: 'number', placeholder: '7500000' },
    { key: 'current_value', label: 'Current Value (₹)', type: 'number', placeholder: '9500000' },
    { key: 'rental_yield', label: 'Rental Yield (%)', type: 'number', placeholder: '3.5' },
    { key: 'area', label: 'Area', type: 'number', placeholder: '1200' },
    { key: 'area_unit', label: 'Unit', options: ['sqft', 'sqm', 'acres', 'guntha'] },
    { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
    { key: 'emi', label: 'Monthly EMI (₹)', type: 'number', placeholder: '45000' },
    { key: 'loan_outstanding', label: 'Loan Outstanding (₹)', type: 'number', placeholder: '3500000' },
    { key: 'tenant_name', label: 'Tenant / Use', placeholder: 'Own use / Tenant name' },
    { key: 'lease_expiry', label: 'Lease Expiry', placeholder: 'e.g. Dec 2026' },
    { key: 'floors', label: 'Floor / Location Info', placeholder: '4th Floor, Tower B' },
    { key: 'facing', label: 'Facing', placeholder: 'North-East' },
  ];

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl">apartment</span>
              Add Property
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
              Record a real estate holding
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                <label className={labelCls}>{f.label}</label>
                {f.options ? (
                  <select
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 [color-scheme:dark]'}
                    style={inputStyle}
                  >
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls + (f.type === 'date' ? ' [color-scheme:dark]' : '')}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={!form.name}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}>
              <span className="material-symbols-outlined text-sm">apartment</span>
              Add Property
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

export default function RealEstatePage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/real-estate');
      if (res.ok) setProperties(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
    const handler = () => fetchProperties();
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, [fetchProperties]);

  async function handleAdd(data: Partial<Property>) {
    const res = await fetch('/api/real-estate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const saved = await res.json();
      setProperties((prev) => [...prev, saved]);
    }
  }

  async function handleEdit(id: string, updates: Partial<Property>) {
    const res = await fetch(`/api/real-estate/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setProperties((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this property?')) return;
    await fetch(`/api/real-estate/${id}`, { method: 'DELETE' });
    setProperties((prev) => prev.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  // Metrics
  const totalCurrent = properties.reduce((a, p) => a + p.current_value, 0);
  const totalPurchase = properties.reduce((a, p) => a + p.purchase_price, 0);
  const appreciation = totalPurchase > 0 ? ((totalCurrent - totalPurchase) / totalPurchase) * 100 : 0;
  const avgYield = properties.length > 0 ? properties.reduce((a, p) => a + p.rental_yield, 0) / properties.length : 0;
  const annualRent = properties.reduce((a, p) => a + (p.current_value * p.rental_yield) / 100, 0);
  const totalLoan = properties.reduce((a, p) => a + p.loan_outstanding, 0);
  const totalEMI = properties.reduce((a, p) => a + p.emi, 0);
  const totalArea = properties.reduce((a, p) => a + (p.area ?? 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16 flex-1 min-w-0">

        {/* KPI row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard label="Property Value" value={totalCurrent} format="inr" icon="apartment" />
          <KPICard label="Appreciation" value={appreciation} format="percent" accent="positive" sub="Since acquisition" icon="trending_up" />
          <KPICard label="Rental Yield" value={avgYield} format="percent" accent="gold" sub="Annualised blended" icon="real_estate_agent" />
          <KPICard label="Annual Rent" value={annualRent} format="inr" sub="Projected gross" icon="receipt_long" />
        </div>

        {/* KPI row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card tier="low" className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-base">credit_card</span>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Loan Outstanding</p>
              <p className="text-lg font-black text-tertiary mt-0.5">{formatINR(totalLoan, { compact: true })}</p>
            </div>
          </Card>
          <Card tier="low" className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-outline/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-outline text-base">payments</span>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Monthly EMI</p>
              <p className="text-lg font-black text-on-surface mt-0.5">{totalEMI > 0 ? formatINR(totalEMI) : '—'}</p>
            </div>
          </Card>
          <Card tier="low" className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-base">domain</span>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Total Area</p>
              <p className="text-lg font-black text-on-surface mt-0.5">
                {totalArea > 0 ? `${totalArea.toLocaleString('en-IN')} sqft` : '—'}
              </p>
            </div>
          </Card>
        </div>

        <SectionHeader
          overline="Holdings"
          title="Physical Property Register"
          subtitle="Click any property to expand details"
          right={
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/activity?asset_class=Real+Estate')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/30 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Log Trade
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:scale-[1.01] transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Property
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
          </div>
        ) : properties.length === 0 ? (
          <Card tier="low" className="p-16 text-center">
            <span className="material-symbols-outlined text-5xl text-outline">apartment</span>
            <p className="text-sm text-outline mt-4 mb-6">No properties added yet. Add your first property.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow"
            >
              Add First Property
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {properties.map((p, i) => {
              const gain = p.current_value - p.purchase_price;
              const appPct = p.purchase_price > 0 ? ((p.current_value - p.purchase_price) / p.purchase_price) * 100 : 0;
              const isExpanded = expandedId === p.id;
              const typeColor = TYPE_COLORS[p.property_type] ?? '#adc6ff';

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <Card
                    tier="low"
                    animate={false}
                    className={cn('overflow-hidden h-full transition-all', isExpanded && 'ring-1 ring-outline-variant/30')}
                  >
                    {/* Graphic header */}
                    <div
                      className="h-36 relative overflow-hidden cursor-pointer"
                      style={{ background: `linear-gradient(135deg, ${typeColor}15 0%, ${typeColor}04 100%)` }}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-70">
                        <div className="w-40 h-24">
                          <PropertyGraphic type={p.property_type} color={typeColor} />
                        </div>
                      </div>
                      <div className="absolute top-4 left-4">
                        <Chip variant={p.property_type === 'Residential' ? 'primary' : p.property_type === 'Commercial' ? 'positive' : 'gold'}>
                          {p.property_type}
                        </Chip>
                      </div>
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProperty(p); }}
                          className="flex items-center gap-1 bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors"
                          title="Edit property"
                        >
                          <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="flex items-center gap-1 bg-tertiary/10 text-tertiary hover:bg-tertiary/20 px-2 py-1 rounded-lg transition-colors"
                          title="Remove property"
                        >
                          <span className="material-symbols-outlined text-xs">delete_outline</span>
                        </button>
                        <div className="flex items-center gap-1 bg-surface-container-low/80 backdrop-blur px-2 py-1 rounded-lg">
                          <span className="material-symbols-outlined text-xs" style={{ color: typeColor }}>
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-6 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <h3 className="text-lg font-black tracking-tight text-on-surface">{p.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">
                        {[p.location, p.area ? `${p.area.toLocaleString('en-IN')} ${p.area_unit ?? 'sqft'}` : null].filter(Boolean).join(' · ')}
                      </p>
                      <div className="grid grid-cols-3 gap-4 mt-5">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-outline">Current</p>
                          <p className="text-sm font-black text-on-surface mt-0.5">{formatINR(p.current_value, { compact: true })}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-outline">Gain</p>
                          <p className={cn('text-sm font-black mt-0.5', gain >= 0 ? 'text-secondary' : 'text-tertiary')}>
                            {gain >= 0 ? '+' : ''}{formatINR(gain, { compact: true })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-outline">Yield</p>
                          <p className="text-sm font-black text-gold mt-0.5">{p.rental_yield}%</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={cn(
                          'text-[9px] font-black px-2 py-0.5 rounded-full',
                          appPct >= 0 ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary',
                        )}>
                          {appPct >= 0 ? '+' : ''}{appPct.toFixed(1)}%
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Since purchase</p>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 pt-2 space-y-4 border-t border-outline-variant/10">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                              {[
                                { label: 'Purchase Date', value: p.purchase_date ?? '—' },
                                { label: 'Last Valuation', value: p.last_valuation_date ?? '—' },
                                { label: 'Purchase Price', value: formatINR(p.purchase_price, { compact: true }) },
                                { label: 'Location / Floor', value: p.floors ?? '—' },
                                { label: 'Facing', value: p.facing ?? '—' },
                                { label: 'Area', value: p.area ? `${p.area.toLocaleString('en-IN')} ${p.area_unit ?? 'sqft'}` : '—' },
                              ].map((m) => (
                                <div key={m.label}>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-outline/70">{m.label}</p>
                                  <p className="text-[11px] font-bold text-on-surface mt-0.5">{m.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-outline-variant/10">
                              <div className="p-3 rounded-lg bg-surface-container-highest/20">
                                <p className="text-[8px] font-black uppercase tracking-widest text-outline mb-1">Tenant / Use</p>
                                <p className="text-[11px] font-bold text-on-surface">{p.tenant_name ?? '—'}</p>
                                {p.lease_expiry && <p className="text-[9px] text-outline mt-0.5">Expires {p.lease_expiry}</p>}
                              </div>
                              <div className="p-3 rounded-lg bg-surface-container-highest/20">
                                <p className="text-[8px] font-black uppercase tracking-widest text-outline mb-1">Loan</p>
                                {p.loan_outstanding > 0 ? (
                                  <>
                                    <p className="text-[11px] font-bold text-tertiary">{formatINR(p.loan_outstanding, { compact: true })} outstanding</p>
                                    {p.emi > 0 && <p className="text-[9px] text-outline mt-0.5">EMI {formatINR(p.emi)}/mo</p>}
                                  </>
                                ) : (
                                  <p className="text-[11px] font-bold text-secondary">Debt Free</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

      <AnimatePresence>
        {showAddModal && (
          <AddPropertyModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProperty && (
          <EditPropertyModal
            property={editingProperty}
            onClose={() => setEditingProperty(null)}
            onSave={handleEdit}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
