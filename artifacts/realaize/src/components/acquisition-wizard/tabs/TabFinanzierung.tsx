import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { pdComputeTotalCapitalRequirement, pdComputeTotalLoan, pdComputeEquity } from '@/utils/propertyCashFlowModel';
import type { PropertyData, FinancingTranche } from '@/models/types';
import { FINANCING_TYPES, REPAYMENT_TYPES, uid, fmt, pct, Field, SelectField, Chip, SH } from '@/components/acquisition-wizard/shared';
import { useLanguage } from '@/i18n/LanguageContext';

export function TabFinanzierung({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const de = useLanguage().lang === 'de';
  const totalCapReq = pdComputeTotalCapitalRequirement(pd);
  const totalLoan = pdComputeTotalLoan(pd.financingTranches);
  const equity = pdComputeEquity(pd);
  const ltv = totalCapReq > 0 ? (totalLoan / totalCapReq) * 100 : 0;

  const addTranche = () => {
    onChange({
      financingTranches: [...pd.financingTranches, {
        id: uid(), name: `Tranche ${pd.financingTranches.length + 1}`,
        financingType: 'Bankdarlehen', loanAmount: 0, interestRate: 4.0,
        fixedRatePeriod: 5, loanTerm: 10, repaymentType: 'Annuität',
        amortizationRate: 2.0, disbursementDate: pd.acquisitionDate,
      }]
    });
  };

  const updateTranche = (id: string, patch: Partial<FinancingTranche>) => {
    onChange({ financingTranches: pd.financingTranches.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  return (
    <div>
      <SH>Financing Tranches</SH>
      {pd.financingTranches.map(t => (
        <div key={t.id} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <input className="input-glass" value={t.name} onChange={e => updateTranche(t.id, { name: e.target.value })} style={{ fontWeight: 700, fontSize: 14, width: 200 }} />
            <button onClick={() => onChange({ financingTranches: pd.financingTranches.filter(x => x.id !== t.id) })} className="btn-ghost" style={{ color: '#f87171', padding: '4px 8px' }}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <SelectField label="Financing Type" value={t.financingType} onChange={e => updateTranche(t.id, { financingType: e.target.value as typeof t.financingType })}>
              {FINANCING_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
            </SelectField>
            <Field label="Loan Amount €" type="number" value={t.loanAmount || ''} onChange={e => updateTranche(t.id, { loanAmount: parseFloat(e.target.value) || 0 })} />
            <Field label="Interest Rate % p.a." type="number" step="0.1" value={t.interestRate} onChange={e => updateTranche(t.id, { interestRate: parseFloat(e.target.value) || 0 })} />
            <Field label="Fixed-Rate Period (Years)" type="number" value={t.fixedRatePeriod} onChange={e => updateTranche(t.id, { fixedRatePeriod: parseInt(e.target.value) || 0 })} />
            <Field label="Loan Term (Years)" type="number" value={t.loanTerm} onChange={e => updateTranche(t.id, { loanTerm: parseInt(e.target.value) || 0 })} />
            <SelectField label="Repayment Type" value={t.repaymentType} onChange={e => updateTranche(t.id, { repaymentType: e.target.value as typeof t.repaymentType })}>
              {REPAYMENT_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </SelectField>
            <Field label="Disbursement Date" type="date" value={t.disbursementDate || ''} onChange={e => updateTranche(t.id, { disbursementDate: e.target.value })} />
          </div>
        </div>
      ))}
      <button
        onClick={addTranche}
        className="btn-ghost"
        style={{
          fontSize: 12, marginBottom: 20, whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
        }}
      >
        <Plus size={12} /> {de ? 'Tranche hinzufügen' : 'Add Tranche'}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Chip label="Total Investment" value={fmt(totalCapReq)} />
        <Chip label="Debt" value={fmt(totalLoan)} color="#f87171" />
        <Chip label="Equity" value={fmt(equity)} color="#4ade80" />
        <Chip label="LTV" value={pct(ltv)} color={ltv > 70 ? '#f87171' : ltv > 60 ? '#fbbf24' : '#4ade80'} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 8: Cashflow
// ═══════════════════════════════════════════════════════════════════════════
