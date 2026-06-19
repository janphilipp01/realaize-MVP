import type { AcquisitionDeal } from '../models/types';
import { computeDealKPIs, formatEUR, formatPct, formatX } from './kpiEngine';

// ── PDF Export (jsPDF) ────────────────────────────────────────────────────────
export async function exportInvestmentMemoPDF(deal: AcquisitionDeal): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Header
  doc.setFillColor(15, 14, 13);
  doc.rect(0, 0, PAGE_W, 40, 'F');
  doc.setTextColor(201, 169, 110);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Investment Memorandum', MARGIN, 20);
  doc.setFontSize(11);
  doc.setTextColor(200, 195, 190);
  doc.text(`${deal.name} — ${deal.city}`, MARGIN, 30);
  doc.setFontSize(9);
  doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} | CONFIDENTIAL`, MARGIN, 36);

  let y = 50;

  // Deal summary box
  doc.setFillColor(30, 27, 24);
  doc.roundedRect(MARGIN, y, CONTENT_W, 30, 3, 3, 'F');
  doc.setTextColor(201, 169, 110);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DEAL ÜBERBLICK', MARGIN + 5, y + 8);
  doc.setTextColor(220, 215, 210);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Adresse: ${deal.address}, ${deal.city} ${deal.zip}`, MARGIN + 5, y + 16);
  doc.text(`Nutzungsart: ${deal.usageType}  |  Phase: ${deal.stage}  |  Broker: ${deal.broker || 'N/A'}`, MARGIN + 5, y + 22);
  doc.text(`Asking Price: ${formatEUR(deal.askingPrice)}  |  Total Acquisition Cost: ${formatEUR(kpis.totalAcquisitionCost)}`, MARGIN + 5, y + 28);
  y += 38;

  // KPI table
  doc.setTextColor(15, 14, 13);
  doc.setFillColor(201, 169, 110);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('KENNZAHLEN', MARGIN + 3, y + 5.5);
  y += 10;

  const kpiRows = [
    ['Net Initial Yield (NIY)', formatPct(kpis.netInitialYield)],
    ['Kaufpreisfaktor', formatX(kpis.kaufpreisfaktor)],
    ['Bruttoanfangsrendite', formatPct(kpis.bruttoanfangsrendite)],
    ['NOI', formatEUR(kpis.noi)],
    ['DSCR', formatX(kpis.dscr)],
    ['LTV', formatPct(kpis.ltv, 1)],
    ['Cash-on-Cash Return', formatPct(kpis.cashOnCashReturn)],
    ['Eigenkapital', formatEUR(kpis.equityInvested)],
    ['Jährl. Schuldendienst', formatEUR(kpis.annualDebtService)],
    ['Interest Coverage Proxy', formatX(kpis.interestCoverageProxy)],
  ];

  doc.setFont('helvetica', 'normal');
  kpiRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 246, 244);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    }
    doc.setTextColor(40, 36, 32);
    doc.setFontSize(9);
    doc.text(label, MARGIN + 3, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(value, MARGIN + CONTENT_W - 3, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 7;
  });
  y += 8;

  // Financing
  doc.setFillColor(201, 169, 110);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setTextColor(15, 14, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FINANZIERUNG', MARGIN + 3, y + 5.5);
  y += 10;

  const finRows = [
    ['Kreditgeber', deal.financingAssumptions.lenderName],
    ['Darlehensbetrag', formatEUR(deal.financingAssumptions.loanAmount)],
    ['Zinssatz', `${deal.financingAssumptions.interestRate.toFixed(2)}% p.a.`],
    ['Tilgungsrate', `${deal.financingAssumptions.amortizationRate}% p.a.`],
    ['Zinsbindung', `${deal.financingAssumptions.fixedRatePeriod} Jahre`],
  ];

  doc.setFont('helvetica', 'normal');
  finRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 246, 244);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    }
    doc.setTextColor(40, 36, 32);
    doc.setFontSize(9);
    doc.text(label, MARGIN + 3, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(value, MARGIN + CONTENT_W - 3, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 7;
  });
  y += 10;

  // IC Memo
  if (deal.icMemo) {
    doc.setFillColor(201, 169, 110);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setTextColor(15, 14, 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('IC MEMO — EXECUTIVE SUMMARY', MARGIN + 3, y + 5.5);
    y += 12;

    doc.setTextColor(40, 36, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(deal.icMemo.executiveSummary, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Empfehlung:', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const recLines = doc.splitTextToSize(deal.icMemo.recommendedAction, CONTENT_W);
    doc.text(recLines, MARGIN, y);
    y += recLines.length * 5 + 6;
  }

  // AI Recommendations
  if (deal.aiRecommendations.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFillColor(201, 169, 110);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setTextColor(15, 14, 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('AI RESEARCHER — EMPFEHLUNGEN (Nur zur Unterstützung)', MARGIN + 3, y + 5.5);
    y += 12;

    deal.aiRecommendations.forEach(rec => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 36, 32);
      doc.setFontSize(9);
      doc.text(`• ${rec.title} [${rec.confidence}]`, MARGIN, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const bodyLines = doc.splitTextToSize(rec.body, CONTENT_W - 5);
      doc.text(bodyLines, MARGIN + 3, y);
      y += bodyLines.length * 4.5 + 4;
      if (y > 270) { doc.addPage(); y = 20; }
    });
  }

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 155, 150);
    doc.text(`Lestate Real Investment OS — Vertraulich — Nur zur internen Verwendung — Seite ${i}/${totalPages}`, PAGE_W / 2, 290, { align: 'center' });
    doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')} | M. Wagner`, PAGE_W / 2, 295, { align: 'center' });
  }

  doc.save(`Investment_Memo_${deal.name.replace(/\s+/g, '_')}.pdf`);
}

// ── Excel Export (SheetJS) ────────────────────────────────────────────────────
export async function exportDealExcel(deal: AcquisitionDeal): Promise<void> {
  const XLSX = await import('xlsx');
  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);
  const wb = XLSX.utils.book_new();

  // Sheet 1: KPI Summary
  const kpiData = [
    ['Lestate Real Investment OS — Deal Summary', '', ''],
    ['', '', ''],
    ['Deal', deal.name, ''],
    ['Adresse', `${deal.address}, ${deal.city}`, ''],
    ['Nutzungsart', deal.usageType, ''],
    ['Phase', deal.stage, ''],
    ['Erstellt', new Date().toLocaleDateString('de-DE'), ''],
    ['', '', ''],
    ['KENNZAHLEN', 'Wert', 'Einheit'],
    ['Kaufpreis', deal.underwritingAssumptions.purchasePrice, 'EUR'],
    ['Total Acquisition Cost', kpis.totalAcquisitionCost, 'EUR'],
    ['Eigenkapital', kpis.equityInvested, 'EUR'],
    ['Kaufpreisfaktor', kpis.kaufpreisfaktor, 'x'],
    ['Bruttoanfangsrendite', kpis.bruttoanfangsrendite / 100, '%'],
    ['NOI', kpis.noi, 'EUR'],
    ['Net Initial Yield', kpis.netInitialYield / 100, '%'],
    ['Cash-on-Cash Return', kpis.cashOnCashReturn / 100, '%'],
    ['DSCR', kpis.dscr, 'x'],
    ['LTV', kpis.ltv / 100, '%'],
    ['Interest Coverage', kpis.interestCoverageProxy, 'x'],
    ['Jährl. Schuldendienst', kpis.annualDebtService, 'EUR'],
    ['', '', ''],
    ['FINANZIERUNG', 'Wert', 'Einheit'],
    ['Kreditgeber', deal.financingAssumptions.lenderName, ''],
    ['Darlehen', deal.financingAssumptions.loanAmount, 'EUR'],
    ['Zinssatz', deal.financingAssumptions.interestRate / 100, '%'],
    ['Tilgungsrate', deal.financingAssumptions.amortizationRate / 100, '%'],
    ['Zinsbindung', deal.financingAssumptions.fixedRatePeriod, 'Jahre'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(kpiData);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'KPI Summary');

  // Sheet 2: Underwriting Assumptions
  const uwData = [
    ['UNDERWRITING ANNAHMEN', ''],
    ['Kaufpreis (EUR)', deal.underwritingAssumptions.purchasePrice],
    ['Kaufnebenkosten (%)', deal.underwritingAssumptions.closingCostPercent],
    ['Maklergebühr (%)', deal.underwritingAssumptions.brokerFeePercent],
    ['Initialer CapEx (EUR)', deal.underwritingAssumptions.initialCapex],
    ['Jahreskaltmiete (EUR)', deal.underwritingAssumptions.annualGrossRent],
    ['Leerstandsrate (%)', deal.underwritingAssumptions.vacancyRatePercent],
    ['Verwaltungskosten (%)', deal.underwritingAssumptions.managementCostPercent],
    ['Instandhaltungsreserve (€/m²/J)', deal.underwritingAssumptions.maintenanceReservePerSqm],
    ['Nicht-umlagefähige Kosten (EUR)', deal.underwritingAssumptions.nonRecoverableOpex],
    ['Fläche (m²)', deal.underwritingAssumptions.area],
    ['Miete pro m²/Monat', deal.underwritingAssumptions.rentPerSqm],
    ['Sonstige Einnahmen (EUR)', deal.underwritingAssumptions.otherOperatingIncome],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(uwData);
  ws2['!cols'] = [{ wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Underwriting');

  // Sheet 3: Scenarios
  const scenarios = [
    { label: 'Base Case', rentMod: 0, vacMod: 0, rateMod: 0 },
    { label: '+100bps Zinsen', rentMod: 0, vacMod: 0, rateMod: 1.0 },
    { label: '-10% Miete', rentMod: -10, vacMod: 0, rateMod: 0 },
    { label: '+5% Leerstand', rentMod: 0, vacMod: 5, rateMod: 0 },
    { label: 'Stress (alle)', rentMod: -8, vacMod: 3, rateMod: 0.75 },
  ];
  const scenHeader = ['Szenario', 'NIY (%)', 'DSCR (x)', 'Cash-on-Cash (%)', 'NOI (EUR)', 'LTV (%)'];
  const scenRows = scenarios.map(s => {
    const uw = { ...deal.underwritingAssumptions, annualGrossRent: deal.underwritingAssumptions.annualGrossRent * (1 + s.rentMod / 100), vacancyRatePercent: deal.underwritingAssumptions.vacancyRatePercent + s.vacMod };
    const fin = { ...deal.financingAssumptions, interestRate: deal.financingAssumptions.interestRate + s.rateMod };
    const sk = computeDealKPIs(uw, fin);
    return [s.label, sk.netInitialYield.toFixed(2), sk.dscr.toFixed(2), sk.cashOnCashReturn.toFixed(2), Math.round(sk.noi), sk.ltv.toFixed(1)];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([scenHeader, ...scenRows]);
  ws3['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Szenario-Analyse');

  XLSX.writeFile(wb, `Lender_Package_${deal.name.replace(/\s+/g, '_')}.xlsx`);
}

// ══════════════════════════════════════════════════════════
// NEWS REPORT — PDF EXPORT
// ══════════════════════════════════════════════════════════

import type { DailyIntelligenceReport } from '../models/types';
import type { MarketLocation } from '@workspace/api-client-react';

export async function exportNewsReportPDF(report: DailyIntelligenceReport): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Header
  doc.setFillColor(0, 122, 255);
  doc.rect(0, 0, PAGE_W, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Intelligence Report', MARGIN, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const reportDate = new Date(report.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${reportDate} · ${report.articles.length} Articles`, MARGIN, 28);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString('de-DE')} · Lestate Real Investment OS`, MARGIN, 33);

  let y = 45;

  // Executive Summary
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'F');
  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('EXECUTIVE SUMMARY', MARGIN + 4, y + 6);
  y += 12;

  doc.setTextColor(40, 40, 45);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(report.executiveSummary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 4.5 + 8;

  // Market Impact
  if (report.marketImpactAnalysis) {
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'F');
    doc.setTextColor(0, 122, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('MARKET IMPACT ANALYSIS', MARGIN + 4, y + 6);
    y += 12;

    doc.setTextColor(40, 40, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const impactLines = doc.splitTextToSize(report.marketImpactAnalysis, CONTENT_W);
    doc.text(impactLines, MARGIN, y);
    y += impactLines.length * 4.5 + 8;
  }

  // Articles
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'F');
  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`ARTICLES (${report.articles.length})`, MARGIN + 4, y + 6);
  y += 12;

  report.articles.forEach((article, i) => {
    if (y > 265) { doc.addPage(); y = 20; }
    const impactColor = article.impactRating === 'high' ? [220, 50, 50] : article.impactRating === 'medium' ? [200, 150, 30] : [60, 180, 80];
    doc.setFillColor(impactColor[0], impactColor[1], impactColor[2]);
    doc.circle(MARGIN + 2, y + 2, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 35);
    doc.setFontSize(9);
    doc.text(article.title, MARGIN + 7, y + 3);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    const artLines = doc.splitTextToSize(`${article.summary} — ${article.sourceLabel} [${article.impactRating.toUpperCase()}]`, CONTENT_W - 7);
    doc.text(artLines, MARGIN + 7, y);
    y += artLines.length * 3.8 + 5;
  });

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 165);
    doc.text(`Lestate Real Investment OS — Daily Intelligence — Confidential — Page ${i}/${totalPages}`, PAGE_W / 2, 292, { align: 'center' });
  }

  doc.save(`Intelligence_Report_${report.date}.pdf`);
}

// ══════════════════════════════════════════════════════════
// MARKET INTELLIGENCE — EXCEL EXPORT
// ══════════════════════════════════════════════════════════

export async function exportMarketIntelligenceExcel(locations: MarketLocation[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overviewHeader = ['City', 'Region', 'Submarket', 'Benchmarks', 'Last Updated'];
  const overviewRows = locations.map(l => [l.city, l.region, l.submarket, l.benchmarks.length, l.lastUpdated]);
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['Lestate Real Market Intelligence Export', '', '', '', ''],
    [`Generated: ${new Date().toLocaleDateString('de-DE')}`, '', '', '', ''],
    [],
    overviewHeader,
    ...overviewRows,
  ]);
  ws1['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

  // Sheet 2: All Benchmarks (flat table)
  const bmHeader = ['City', 'Usage Type', 'Rent Min (€/m²/mo)', 'Rent Median', 'Rent Max', 'Price Min (€/m²)', 'Price Median', 'Price Max', 'Multiplier Min', 'Multiplier Median', 'Multiplier Max', 'Vacancy (%)', 'Confidence', 'Source', 'Last Updated'];
  const bmRows = locations.flatMap(l =>
    l.benchmarks.map(b => [
      l.city, b.usageType,
      b.rentMin, b.rentMedian, b.rentMax,
      b.purchasePriceMin, b.purchasePriceMedian, b.purchasePriceMax,
      b.multiplierMin, b.multiplierMedian, b.multiplierMax,
      b.vacancyRatePercent, b.confidenceScore,
      b.sourceLabel, b.lastUpdated,
    ])
  );
  const ws2 = XLSX.utils.aoa_to_sheet([bmHeader, ...bmRows]);
  ws2['!cols'] = bmHeader.map((_, i) => ({ wch: i === 0 ? 20 : i === 1 ? 14 : i === 13 ? 28 : 13 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Benchmarks');

  // Sheet 3: Per-city rent comparison (pivot-style)
  const usageTypes = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik'];
  const rentHeader = ['City', ...usageTypes.map(t => `${t} (€/m²/mo)`)];
  const rentRows = locations.map(l => {
    const row: (string | number)[] = [l.city];
    usageTypes.forEach(ut => {
      const bm = l.benchmarks.find(b => b.usageType === ut);
      row.push(bm ? bm.rentMedian : 0);
    });
    return row;
  });
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Rent Comparison by City & Usage Type'],
    [],
    rentHeader,
    ...rentRows,
  ]);
  ws3['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Rent Comparison');

  // Sheet 4: Per-city multiplier comparison
  const multHeader = ['City', ...usageTypes.map(t => `${t} (x)`)];
  const multRows = locations.map(l => {
    const row: (string | number)[] = [l.city];
    usageTypes.forEach(ut => {
      const bm = l.benchmarks.find(b => b.usageType === ut);
      row.push(bm ? bm.multiplierMedian : 0);
    });
    return row;
  });
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Multiplier Comparison by City & Usage Type'],
    [],
    multHeader,
    ...multRows,
  ]);
  ws4['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Multiplier Comparison');

  XLSX.writeFile(wb, `Market_Intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── News Excel Export ────────────────────────────────────
export async function exportNewsExcel(report: DailyIntelligenceReport): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const articlesHeader = ['Title', 'Category', 'Source', 'Impact', 'Summary', 'URL'];
  const articlesRows = report.articles.map(a => [a.title, a.category, a.sourceLabel, a.impactRating, a.summary, a.sourceUrl]);
  const ws = XLSX.utils.aoa_to_sheet([
    [`Daily Intelligence Report — ${report.date}`],
    [],
    ['Executive Summary'],
    [report.executiveSummary],
    [],
    ['Market Impact Analysis'],
    [report.marketImpactAnalysis],
    [],
    articlesHeader,
    ...articlesRows,
  ]);
  ws['!cols'] = [{ wch: 40 }, { wch: 24 }, { wch: 20 }, { wch: 10 }, { wch: 60 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Intelligence Report');

  XLSX.writeFile(wb, `Intelligence_Report_${report.date}.xlsx`);
}
