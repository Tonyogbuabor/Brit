import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { SERVER_CONFIG } from './server/config.js';
import { snapshotStore, computePlatformKpis } from './server/snapshot/store.js';
import { campaignStore } from './server/campaigns/store.js';
import { generateCustomerRetentionPlan } from './server/recommend/gemini.js';
import { simulateCustomerWhatIf, simulateCohortWhatIf } from './server/whatif/simulator.js';
import { handleUserChatMessage } from './server/chat/assistant.js';
import { generateExcelReport } from './server/reports/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite dev requires inline scripts and styles
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '10mb' }));

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.', hint: 'Wait 60 seconds.' } },
});

const heavyAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: { code: 'AI_RATE_LIMIT_EXCEEDED', message: 'Retention recommendation rate limit reached.', hint: 'Wait a moment before regenerating.' } },
});

app.use('/api/', apiLimiter);
app.use('/api/chat', heavyAiLimiter);
app.use('/api/recommendations', heavyAiLimiter);

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// GET /api/health
app.get('/api/health', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  const status = snapshotStore.getStatus();
  res.json({
    status: 'ok',
    snapshotLoaded: !!snap,
    lastRefreshed: snap?.meta.timestamp || null,
    rowCount: snap?.meta.rowCount || 0,
    isRefreshing: status.isRefreshing,
  });
});

// GET /api/snapshot/meta
app.get('/api/snapshot/meta', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  const status = snapshotStore.getStatus();
  if (!snap) {
    return res.status(503).json({
      error: { code: 'SNAPSHOT_NOT_READY', message: 'Data snapshot is initializing.', hint: 'Check /api/refresh/status' },
      status,
    });
  }
  res.json({
    meta: snap.meta,
    qualityScore: snap.meta.dataQualityScore,
    status,
  });
});

// POST /api/refresh
app.post('/api/refresh', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    // Single-flight refresh trigger
    const refreshPromise = snapshotStore.triggerRefresh(force);

    // Return immediate 202 Accepted with status
    res.status(202).json({
      message: 'Refresh job initiated or joined.',
      status: snapshotStore.getStatus(),
    });

    // Await in background
    await refreshPromise;
  } catch (err: any) {
    console.error('[API /api/refresh error]', err.message);
  }
});

// GET /api/refresh/status
app.get('/api/refresh/status', (req: Request, res: Response) => {
  res.json(snapshotStore.getStatus());
});

// GET /api/kpis
app.get('/api/kpis', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.', hint: 'Retry in 5 seconds.' } });
  }

  // Support global query filters: serviceType, contractType, customerSegment, ukNation
  const { serviceType, contractType, customerSegment, ukNation } = req.query;

  let filtered = snap.customers;
  if (serviceType && serviceType !== 'All') {
    filtered = filtered.filter((c) => c.serviceType === serviceType);
  }
  if (contractType && contractType !== 'All') {
    filtered = filtered.filter((c) => c.contractType === contractType);
  }
  if (customerSegment && customerSegment !== 'All') {
    filtered = filtered.filter((c) => c.customerSegment === customerSegment);
  }
  if (ukNation && ukNation !== 'All') {
    filtered = filtered.filter((c) => c.ukNation === ukNation);
  }

  // If no filters applied, return precomputed platform KPIs directly
  if (filtered.length === snap.customers.length) {
    return res.json(snap.kpis);
  }

  // Compute filtered KPIs reproducibly
  const filteredKpis = computePlatformKpis(filtered, snap.kpis);
  res.json(filteredKpis);
});

// GET /api/customers
app.get('/api/customers', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }

  const {
    serviceType,
    contractType,
    customerSegment,
    ukNation,
    riskTier,
    churnStatus,
    personaId,
    search,
    sortBy = 'expectedMrrAtRiskGbp',
    sortOrder = 'desc',
    page = '1',
    limit = '50',
  } = req.query;

  let list = snap.customers;

  // Filters
  if (serviceType && serviceType !== 'All') list = list.filter((c) => c.serviceType === serviceType);
  if (contractType && contractType !== 'All') list = list.filter((c) => c.contractType === contractType);
  if (customerSegment && customerSegment !== 'All') list = list.filter((c) => c.customerSegment === customerSegment);
  if (ukNation && ukNation !== 'All') list = list.filter((c) => c.ukNation === ukNation);
  if (riskTier && riskTier !== 'All') list = list.filter((c) => c.riskTier === riskTier);
  if (churnStatus && churnStatus !== 'All') list = list.filter((c) => c.churnStatus === churnStatus);
  if (personaId && personaId !== 'All') list = list.filter((c) => c.personaId === personaId);

  // Search by Customer ID or City
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((c) => c.customerId.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.planName.toLowerCase().includes(q));
  }

  // Sorting
  const sortKey = String(sortBy);
  const isAsc = sortOrder === 'asc';
  list = [...list].sort((a: any, b: any) => {
    const valA = a[sortKey] ?? 0;
    const valB = b[sortKey] ?? 0;
    if (typeof valA === 'string') {
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return isAsc ? valA - valB : valB - valA;
  });

  const pageNum = parseInt(String(page), 10) || 1;
  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
  const total = list.length;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = list.slice(startIndex, startIndex + limitNum);

  res.json({
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    customers: paginated,
  });
});

// GET /api/customers/:id
app.get('/api/customers/:id', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }

  const customer = snap.customers.find((c) => c.customerId.toLowerCase() === req.params.id.toLowerCase());
  if (!customer) {
    return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: `Customer with ID ${req.params.id} does not exist.` } });
  }

  res.json({
    customer,
    activeBaseBenchmark: snap.ensembleModel.activeMedians,
    approvedOffers: SERVER_CONFIG.APPROVED_CATALOGUE,
  });
});

// GET /api/model
app.get('/api/model', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }
  res.json({
    modelCard: snap.modelCard,
    selectedModel: snap.ensembleModel.selectedModelName,
  });
});

// GET /api/segments
app.get('/api/segments', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }
  res.json({
    personas: snap.personas,
  });
});

// GET /api/data-health
app.get('/api/data-health', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }
  res.json(snap.qualityReport);
});

// POST /api/whatif
const WhatIfSchema = z.object({
  mode: z.enum(['customer', 'cohort']),
  customerId: z.string().optional(),
  levers: z.object({
    discountPercent: z.number().min(0).max(100).optional(),
    contractType: z.enum(['Rolling Monthly', '12 Months', '24 Months']).optional(),
    autoRenew: z.boolean().optional(),
    directDebit: z.boolean().optional(),
    serviceType: z.enum(['Mobile', 'Home Broadband', 'Fibre Broadband', 'Mobile + Broadband Bundle']).optional(),
    resolvedComplaints: z.number().min(0).optional(),
    resolvedTickets: z.number().min(0).optional(),
    networkOutages: z.number().min(0).optional(),
    averageResolutionHours: z.number().min(0).optional(),
    satisfactionScore: z.number().min(1).max(10),
    competitorOfferReceived: z.boolean().optional(),
  }),
  cohortFilters: z.object({
    riskTier: z.string().optional(),
    serviceType: z.string().optional(),
    contractType: z.string().optional(),
  }).optional(),
  acceptanceRate: z.number().min(0).max(1).optional(),
});

app.post('/api/whatif', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }

  const parseResult = WhatIfSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid What-If configuration.', hint: parseResult.error.message } });
  }

  const { mode, customerId, levers, cohortFilters, acceptanceRate } = parseResult.data;

  if (mode === 'customer') {
    if (!customerId) {
      return res.status(400).json({ error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required for customer simulation.' } });
    }
    const customer = snap.customers.find((c) => c.customerId.toLowerCase() === customerId.toLowerCase());
    if (!customer) {
      return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: `Customer ${customerId} not found.` } });
    }
    const result = simulateCustomerWhatIf(customer, levers, snap.ensembleModel);
    return res.json(result);
  }

  // Cohort mode
  let cohort = snap.customers.filter((c) => c.churnFlag === 0);
  if (cohortFilters?.riskTier && cohortFilters.riskTier !== 'All') {
    cohort = cohort.filter((c) => c.riskTier === cohortFilters.riskTier);
  }
  if (cohortFilters?.serviceType && cohortFilters.serviceType !== 'All') {
    cohort = cohort.filter((c) => c.serviceType === cohortFilters.serviceType);
  }
  if (cohortFilters?.contractType && cohortFilters.contractType !== 'All') {
    cohort = cohort.filter((c) => c.contractType === cohortFilters.contractType);
  }

  const cohortResult = simulateCohortWhatIf(cohort, levers, snap.ensembleModel, acceptanceRate || 0.40);
  res.json(cohortResult);
});

// POST /api/recommendations
const RecommendationSchema = z.object({
  customerId: z.string(),
});

app.post('/api/recommendations', async (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot loading in progress.' } });
  }

  const parseResult = RecommendationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'customerId is required.' } });
  }

  const customer = snap.customers.find((c) => c.customerId.toLowerCase() === parseResult.data.customerId.toLowerCase());
  if (!customer) {
    return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: `Customer ${parseResult.data.customerId} not found.` } });
  }

  try {
    const plan = await generateCustomerRetentionPlan(customer, snap.modelCard.modelVersion, snap.meta.contentHash);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'RECOMMENDATION_ERROR', message: err.message } });
  }
});

// CRUD /api/campaigns
app.get('/api/campaigns', (req: Request, res: Response) => {
  res.json(campaignStore.getAll());
});

app.get('/api/campaigns/:id', (req: Request, res: Response) => {
  const c = campaignStore.getById(req.params.id);
  if (!c) {
    return res.status(404).json({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' } });
  }
  res.json(c);
});

const CreateCampaignSchema = z.object({
  name: z.string().min(3),
  objective: z.string().min(5),
  targetCriteria: z.object({
    tiers: z.array(z.enum(['Critical', 'High', 'Medium', 'Low'])).optional(),
    serviceTypes: z.array(z.enum(['Mobile', 'Home Broadband', 'Fibre Broadband', 'Mobile + Broadband Bundle'])).optional(),
    minMrr: z.number().optional(),
  }),
  offerId: z.string(),
  offerName: z.string(),
  channel: z.string(),
  budgetGbp: z.number().min(0),
  startDate: z.string(),
  endDate: z.string(),
  owner: z.string(),
  holdoutPercentage: z.number().min(5).max(30).default(10),
});

app.post('/api/campaigns', (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot not loaded' } });
  }

  const parseResult = CreateCampaignSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: parseResult.error.message } });
  }

  const data = parseResult.data;
  let targetPool = snap.customers.filter((c) => c.churnFlag === 0);

  if (data.targetCriteria.tiers && data.targetCriteria.tiers.length > 0) {
    targetPool = targetPool.filter((c) => data.targetCriteria.tiers!.includes(c.riskTier));
  }
  if (data.targetCriteria.serviceTypes && data.targetCriteria.serviceTypes.length > 0) {
    targetPool = targetPool.filter((c) => data.targetCriteria.serviceTypes!.includes(c.serviceType));
  }
  if (data.targetCriteria.minMrr !== undefined) {
    targetPool = targetPool.filter((c) => c.monthlyChargeGbp >= data.targetCriteria.minMrr!);
  }

  const newCampaign = campaignStore.createCampaign(data, targetPool);
  res.status(201).json(newCampaign);
});

// PATCH /api/campaigns/:id/customers/:customerId
app.patch('/api/campaigns/:id/customers/:customerId', (req: Request, res: Response) => {
  const { status, notes } = req.body;
  const updated = campaignStore.updateCustomerStatus(req.params.id, req.params.customerId, status, notes);
  if (!updated) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign or customer not found' } });
  }
  res.json(updated);
});

// POST /api/campaigns/:id/upload-outcomes
app.post('/api/campaigns/:id/upload-outcomes', (req: Request, res: Response) => {
  const { outcomes } = req.body;
  if (!Array.isArray(outcomes)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'outcomes must be an array' } });
  }
  const updated = campaignStore.uploadOutcomesCsv(req.params.id, outcomes);
  if (!updated) {
    return res.status(404).json({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' } });
  }
  res.json(updated);
});

// POST /api/chat
const ChatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).default([]),
});

app.post('/api/chat', async (req: Request, res: Response) => {
  const parseResult = ChatSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: parseResult.error.message } });
  }

  try {
    const reply = await handleUserChatMessage(parseResult.data.history, parseResult.data.message);
    res.json(reply);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'CHAT_ERROR', message: err.message } });
  }
});

// GET /api/reports/:type
app.get('/api/reports/:type', async (req: Request, res: Response) => {
  const snap = snapshotStore.getSnapshot();
  if (!snap) {
    return res.status(503).json({ error: { code: 'SNAPSHOT_NOT_LOADED', message: 'Snapshot not loaded' } });
  }

  const reportType = req.params.type;
  if (reportType === 'excel') {
    try {
      const buffer = await generateExcelReport(snap, req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="BritConnect_Churn_Intelligence_${snap.meta.modelVersion}.xlsx"`);
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({ error: { code: 'EXCEL_GEN_ERROR', message: err.message } });
    }
  }

  if (reportType === 'call-list-csv') {
    const atRisk = snap.customers
      .filter((c) => c.churnFlag === 0 && ['Critical', 'High'].includes(c.riskTier))
      .sort((a, b) => b.expectedMrrAtRiskGbp - a.expectedMrrAtRiskGbp);

    const headers = 'Customer ID,Segment,Service Type,Plan Name,Contract Type,Monthly Charge GBP,Churn Probability,Risk Tier,Expected MRR At Risk GBP,Top Risk Driver\n';
    const rows = atRisk.map((c) =>
      `"${c.customerId}","${c.customerSegment}","${c.serviceType}","${c.planName}","${c.contractType}",${c.monthlyChargeGbp},${(c.churnProbability * 100).toFixed(1)}%,"${c.riskTier}",${c.expectedMrrAtRiskGbp},"${(c.topRiskDrivers[0]?.narrative || '').replace(/"/g, '""')}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="BritConnect_AtRisk_CallList_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(headers + rows);
  }

  res.status(404).json({ error: { code: 'UNKNOWN_REPORT_TYPE', message: `Report type ${reportType} not supported.` } });
});

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Start listening
  const server = app.listen(SERVER_CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[BritConnect Server] Listening on http://0.0.0.0:${SERVER_CONFIG.PORT}`);
    // Trigger background initial snapshot loading if not loaded
    if (!snapshotStore.getSnapshot()) {
      console.log('[BritConnect Server] Initiating background Google Sheets data ingestion...');
      snapshotStore.triggerRefresh(false).catch((err) => {
        console.error('[BritConnect Server] Initial refresh background error:', err.message);
      });
    }
  });

  return server;
}

startServer();
