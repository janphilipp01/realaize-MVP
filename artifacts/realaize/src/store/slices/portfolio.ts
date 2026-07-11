import type { Asset, DevelopmentProject, SaleObject, PropertyData } from '../../models/types';
import { mockAssets, mockDeals, mockDevelopments, mockSales } from '../../data/mockData';
import type { SetState, GetState } from './types';
import type { AppState } from '../appState';

export const portfolioSlice = (set: SetState, get: GetState): Pick<AppState, 'assets' | 'deals' | 'developments' | 'sales' | 'updateAsset' | 'deleteAsset' | 'addDeal' | 'updateDeal' | 'addActivityToDeal' | 'deleteDeal' | 'transferToBestand' | 'transferToDevelopment' | 'updateDevelopment' | 'deleteDevelopment' | 'addGewerk' | 'updateGewerk' | 'deleteGewerk' | 'addActivityToDevelopment' | 'addDevUnit' | 'updateDevUnit' | 'deleteDevUnit' | 'transferDevToBestand' | 'transferDevToSale' | 'addOffer' | 'updateOffer' | 'deleteOffer' | 'addInvoice' | 'updateInvoice' | 'deleteInvoice' | 'addGewerkePosition' | 'updateGewerkePosition' | 'deleteGewerkePosition' | 'updateDealPropertyData' | 'updateDevelopmentPropertyData' | 'updateSale' | 'deleteSale' | 'markSaleAsSold' | 'returnSaleToBestand' | 'addBuyer' | 'updateBuyer'> => ({
      assets: mockAssets,
      deals: mockDeals,
      developments: mockDevelopments,
      sales: mockSales,

      updateAsset: (id, patch) =>
        set(s => ({ assets: s.assets.map(a => a.id === id ? { ...a, ...patch } : a) })),

      deleteAsset: (id) =>
        set(s => ({ assets: s.assets.filter(a => a.id !== id) })),

      addDeal: (deal) =>
        set(s => ({
          deals: [...s.deals, deal],
          auditLog: [{
            id: `audit-${Date.now()}`,
            action: 'New Deal Created',
            entityType: 'Deal',
            entityId: deal.id,
            entityName: deal.name,
            user: 'M. Wagner',
            timestamp: new Date().toISOString(),
            details: `Deal "${deal.name}" created in stage ${deal.stage}.`,
          }, ...s.auditLog],
        })),

      updateDeal: (id, patch) =>
        set(s => ({ deals: s.deals.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d) })),

      addActivityToDeal: (dealId, entry) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, activityLog: [entry, ...d.activityLog] } : d) })),

      deleteDeal: (dealId) =>
        set(s => ({ deals: s.deals.filter(d => d.id !== dealId) })),

      transferToBestand: (dealId) => {
        const deal = get().deals.find(d => d.id === dealId);
        if (!deal) return;
        const ma = deal.underwritingAssumptions.marketAssumptions;
        const s = get().settings;
        const newAsset: Asset = {
          id: `asset-${Date.now()}`, name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
          usageType: deal.usageType, status: 'Bestand', acquisitionDate: new Date().toISOString().split('T')[0],
          purchasePrice: deal.underwritingAssumptions.purchasePrice, currentValue: deal.underwritingAssumptions.purchasePrice,
          totalArea: deal.totalArea || deal.underwritingAssumptions.area, lettableArea: deal.underwritingAssumptions.area,
          occupancyRate: 1 - deal.underwritingAssumptions.vacancyRatePercent / 100,
          annualRent: deal.underwritingAssumptions.annualGrossRent,
          operatingCosts: {
            vacancyRatePercent: deal.underwritingAssumptions.vacancyRatePercent,
            managementCostPercent: deal.underwritingAssumptions.managementCostPercent,
            maintenanceReservePerSqm: deal.underwritingAssumptions.maintenanceReservePerSqm,
            nonRecoverableOpex: deal.underwritingAssumptions.nonRecoverableOpex,
            otherOperatingIncome: deal.underwritingAssumptions.otherOperatingIncome,
            rentalGrowthRate: ma?.rentalGrowthRate ?? s.defaultRentalGrowthRate,
          },
          exitCapRate: ma?.exitCapRate ?? (s.defaultExitCapRates[deal.usageType] || 5.0),
          holdingPeriodYears: ma?.holdingPeriodYears ?? s.defaultHoldingPeriod,
          ervPerSqm: deal.underwritingAssumptions.ervPerSqm || deal.underwritingAssumptions.rentPerSqm,
          units: (deal.units || []).map(u => ({ ...u, assetId: newAsset.id })),
          debtInstruments: [], covenants: [], cashFlows: [], documents: deal.documents, capexProjects: [],
          completenessScore: (deal.units || []).length > 0 ? 60 : 40,
        };
        set(s => ({
          assets: [...s.assets, newAsset],
          deals: s.deals.filter(d => d.id !== dealId),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'In Bestand überführt', entityType: 'Asset', entityId: newAsset.id, entityName: deal.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Deal "${deal.name}" in Bestand überführt.` }, ...s.auditLog],
        }));
      },

      transferToDevelopment: (dealId) => {
        const deal = get().deals.find(d => d.id === dealId);
        if (!deal) return;
        const newDevId = `dev-${Date.now()}`;
        const now = new Date().toISOString();
        const devPropertyData = deal.propertyData
          ? JSON.parse(JSON.stringify(deal.propertyData))
          : undefined;
        const snapshot = devPropertyData
          ? JSON.parse(JSON.stringify(devPropertyData))
          : undefined;
        const newDev: DevelopmentProject = {
          id: newDevId, dealId, name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
          usageType: deal.usageType,
          developmentType: deal.developmentType || (devPropertyData?.developmentType as any) || 'Modernisierung',
          status: 'Planung',
          totalArea: deal.totalArea || deal.underwritingAssumptions.area,
          startDate: devPropertyData?.projectStart || deal.underwritingAssumptions.startDate || new Date().toISOString().split('T')[0],
          plannedEndDate: deal.underwritingAssumptions.plannedEndDate
            || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * ((deal.estimatedDevDuration || 24) / 12)).toISOString().split('T')[0],
          purchasePrice: devPropertyData?.purchasePrice || deal.underwritingAssumptions.purchasePrice,
          totalBudget: deal.estimatedDevBudget || deal.underwritingAssumptions.initialCapex,
          gewerke: (deal.gewerke || []).map(g => ({
            id: g.id, developmentId: newDevId,
            category: g.category, description: g.description,
            underwritingBudget: g.underwritingBudget,
            unit: 'Pauschal', quantity: 1, status: 'Offen' as const,
          })),
          units: (deal.units || []).map(u => ({ ...u, assetId: newDevId })),
          documents: deal.documents, activityLog: [], advisorMessages: [], images: [],
          completenessScore: (deal.gewerke || []).length > 0 ? 55 : 30, holdSellDecision: 'Offen',
          propertyData: devPropertyData,
          underwritingSnapshot: snapshot,
          offers: [],
          invoices: [],
        };
        set(s => ({
          developments: [...s.developments, newDev],
          deals: s.deals.filter(d => d.id !== dealId),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'In Development überführt', entityType: 'Asset', entityId: newDev.id, entityName: deal.name, user: 'M. Wagner', timestamp: now, details: `Deal "${deal.name}" in Development überführt.` }, ...s.auditLog],
        }));
      },

      updateDevelopment: (id, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === id ? { ...d, ...patch } : d) })),

      deleteDevelopment: (id) =>
        set(s => ({ developments: s.developments.filter(d => d.id !== id) })),

      addGewerk: (devId, gw) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: [...d.gewerke, gw] } : d) })),

      updateGewerk: (devId, gwId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: d.gewerke.map(g => g.id === gwId ? { ...g, ...patch } : g) } : d) })),

      deleteGewerk: (devId, gwId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: d.gewerke.filter(g => g.id !== gwId) } : d) })),

      addActivityToDevelopment: (devId, entry) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, activityLog: [entry, ...d.activityLog] } : d) })),

      addDevUnit: (devId, unit) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: [...(d.units || []), unit] } : d) })),

      updateDevUnit: (devId, unitId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: (d.units || []).map(u => u.id === unitId ? { ...u, ...patch } : u) } : d) })),

      deleteDevUnit: (devId, unitId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: (d.units || []).filter(u => u.id !== unitId) } : d) })),

      transferDevToBestand: (devId) => {
        const dev = get().developments.find(d => d.id === devId);
        if (!dev) return;
        const newAssetId = `asset-${Date.now()}`;
        const cfg = get().settings;

        // If dev has propertyData, use it with target→asIs swap
        let assetPropertyData: PropertyData | undefined;
        if (dev.propertyData) {
          const pd: PropertyData = JSON.parse(JSON.stringify(dev.propertyData));
          if (pd.unitsTarget.length > 0) {
            pd.unitsAsIs = pd.unitsTarget;
            pd.unitsTarget = [];
          }
          assetPropertyData = pd;
        }

        const units = (dev.units || []).map(u => ({ ...u, assetId: newAssetId }));
        const annualRent = assetPropertyData
          ? assetPropertyData.unitsAsIs.reduce((s, u) => s + u.monthlyRent, 0) * 12
          : units.reduce((s, u) => s + u.monthlyRent * 12, 0);
        const lettedUnits = units.filter(u => u.leaseType === 'Vermietet');
        const occupancyRate = units.length > 0 ? lettedUnits.length / units.length : 0;
        const newAsset: Asset = {
          id: newAssetId, name: dev.name, address: dev.address, city: dev.city, zip: dev.zip,
          usageType: dev.usageType, status: 'Bestand', acquisitionDate: new Date().toISOString().split('T')[0],
          purchasePrice: dev.purchasePrice + dev.totalBudget, currentValue: dev.projectedSalePrice || dev.purchasePrice + dev.totalBudget,
          totalArea: dev.totalArea, lettableArea: dev.totalArea * 0.9,
          occupancyRate, annualRent,
          operatingCosts: {
            vacancyRatePercent: cfg.defaultVacancyRate,
            managementCostPercent: cfg.defaultMgmtCostPct,
            maintenanceReservePerSqm: cfg.defaultMaintenancePerSqm,
            nonRecoverableOpex: 0,
            otherOperatingIncome: 0,
            rentalGrowthRate: cfg.defaultRentalGrowthRate,
          },
          exitCapRate: cfg.defaultExitCapRates[dev.usageType] || 5.0,
          holdingPeriodYears: cfg.defaultHoldingPeriod,
          units, debtInstruments: [], covenants: [], cashFlows: [], documents: dev.documents, capexProjects: [],
          completenessScore: assetPropertyData ? 70 : 45,
          propertyData: assetPropertyData,
        };
        set(st => ({
          assets: [...st.assets, newAsset],
          developments: st.developments.map(d => d.id === devId ? { ...d, status: 'Fertiggestellt', holdSellDecision: 'Hold' } : d),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'Development → Bestand', entityType: 'Asset', entityId: newAsset.id, entityName: dev.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Development "${dev.name}" in Bestand überführt.` }, ...st.auditLog],
        }));
      },

      transferDevToSale: (devId) => {
        const dev = get().developments.find(d => d.id === devId);
        if (!dev) return;
        const newSale: SaleObject = {
          id: `sale-${Date.now()}`, sourceType: 'Development', sourceId: devId,
          name: `${dev.name} — Verkauf`, address: dev.address, city: dev.city, zip: dev.zip,
          usageType: dev.usageType, status: 'Vorbereitung',
          targetPrice: dev.projectedSalePrice || dev.purchasePrice * 1.3,
          minimumPrice: (dev.purchasePrice + dev.totalBudget) * 1.1,
          askingPrice: dev.projectedSalePrice || dev.purchasePrice * 1.35,
          totalCost: dev.purchasePrice + dev.totalBudget,
          area: dev.totalArea, documents: dev.documents, buyers: [], activityLog: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        set(s => ({
          sales: [...s.sales, newSale],
          developments: s.developments.map(d => d.id === devId ? { ...d, status: 'Fertiggestellt', holdSellDecision: 'Sell' } : d),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'Development → Sales', entityType: 'Asset', entityId: newSale.id, entityName: dev.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Development "${dev.name}" in Sales überführt.` }, ...s.auditLog],
        }));
      },

      // Offers & Invoices
      addOffer: (devId, offer) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: [...(d.offers || []), offer] } : d) })),
      updateOffer: (devId, offerId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: (d.offers || []).map(o => o.id === offerId ? { ...o, ...patch } : o) } : d) })),
      deleteOffer: (devId, offerId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: (d.offers || []).filter(o => o.id !== offerId) } : d) })),
      addInvoice: (devId, invoice) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: [...(d.invoices || []), invoice] } : d) })),
      updateInvoice: (devId, invoiceId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: (d.invoices || []).map(i => i.id === invoiceId ? { ...i, ...patch } : i) } : d) })),
      deleteInvoice: (devId, invoiceId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: (d.invoices || []).filter(i => i.id !== invoiceId) } : d) })),
      // New Gewerke positions (PropertyData model)
      addGewerkePosition: (devId, gw) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: [...d.propertyData.gewerke, gw] } } : d) })),
      updateGewerkePosition: (devId, gwId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: d.propertyData.gewerke.map(g => g.id === gwId ? { ...g, ...patch } : g) } } : d) })),
      deleteGewerkePosition: (devId, gwId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: d.propertyData.gewerke.filter(g => g.id !== gwId) } } : d) })),
      // PropertyData update
      updateDealPropertyData: (dealId, pd) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, propertyData: pd } : d) })),
      updateDevelopmentPropertyData: (devId, pd) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, propertyData: pd } : d) })),

      updateSale: (id, patch) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === id ? { ...sale, ...patch, updatedAt: new Date().toISOString() } : sale) })),

      deleteSale: (id) =>
        set(s => ({ sales: s.sales.filter(sale => sale.id !== id) })),

      markSaleAsSold: (id, soldPrice, soldAt) =>
        set(s => ({
          sales: s.sales.map(sale => sale.id === id
            ? { ...sale, status: 'Verkauft' as const, soldPrice, soldAt, disposalGain: soldPrice - sale.totalCost, updatedAt: new Date().toISOString() }
            : sale),
        })),

      returnSaleToBestand: (id) => {
        const sale = get().sales.find(s => s.id === id);
        if (!sale) return;
        const newAsset: import('../../models/types').Asset = {
          id: `asset-${Date.now()}`,
          name: sale.name,
          address: sale.address,
          city: sale.city,
          zip: sale.zip,
          usageType: sale.usageType,
          status: 'Bestand',
          acquisitionDate: new Date().toISOString().split('T')[0],
          currentValue: sale.askingPrice,
          purchasePrice: sale.totalCost,
          annualRent: sale.annualRent || 0,
          occupancyRate: 1,
          totalArea: sale.area || 0,
          lettableArea: sale.area || 0,
          operatingCosts: { vacancyRatePercent: 5, managementCostPercent: 3, maintenanceReservePerSqm: 8, nonRecoverableOpex: 0, otherOperatingIncome: 0, rentalGrowthRate: 2 },
          units: [],
          debtInstruments: [],
          covenants: [],
          cashFlows: [],
          documents: [],
          capexProjects: [],
          completenessScore: 20,
        };
        set(s => ({ sales: s.sales.filter(sale => sale.id !== id), assets: [...s.assets, newAsset] }));
      },

      addBuyer: (saleId, buyer) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === saleId ? { ...sale, buyers: [...sale.buyers, buyer] } : sale) })),

      updateBuyer: (saleId, buyerId, patch) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === saleId ? { ...sale, buyers: sale.buyers.map(b => b.id === buyerId ? { ...b, ...patch } : b) } : sale) })),
});
