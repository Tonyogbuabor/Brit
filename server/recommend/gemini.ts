import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { SERVER_CONFIG } from '../config.js';
import { ScoredCustomer, RetentionPlan, RetentionOffer } from '../../shared/types.js';

// Retention Plan Zod Schema for strict validation
const RetentionPlanZodSchema = z.object({
  headlineDiagnosis: z.string().min(10),
  rankedRootCauses: z.array(
    z.object({
      rank: z.number(),
      driver: z.string(),
      explanation: z.string(),
    })
  ).min(1),
  bestNextAction: z.object({
    actionTitle: z.string(),
    offerId: z.string(),
    channel: z.enum(['Call', 'SMS', 'Email', 'App Notification', 'Store Visit']),
    bestTiming: z.string(),
    personalizedScript: z.string(),
    talkingPoints: z.array(z.string()),
    objectionHandling: z.array(z.object({ objection: string(), counter: z.string() })),
    expectedSaveProbabilityMin: z.number().min(0).max(1),
    expectedSaveProbabilityMax: z.number().min(0).max(1),
    offerCostGbp: z.number().min(0),
    expectedNetValueGbp: z.number(),
    escalationPath: z.string(),
  }),
  doNotDoGuardrails: z.array(z.string()).min(1),
  gdprPecrNotice: z.string(),
});

function string() {
  return z.string();
}

// In-memory cache: key = `${customerId}_${modelVersion}_${dataHash}`
const planCache = new Map<string, RetentionPlan>();

export async function generateCustomerRetentionPlan(
  customer: ScoredCustomer,
  modelVersion: string,
  dataHash: string
): Promise<RetentionPlan> {
  const cacheKey = `${customer.customerId}_${modelVersion}_${dataHash}`;
  if (planCache.has(cacheKey)) {
    return planCache.get(cacheKey)!;
  }

  // Check if Gemini API Key is configured
  if (SERVER_CONFIG.GEMINI_API_KEY) {
    try {
      const plan = await callGeminiWithValidation(customer, modelVersion, dataHash);
      planCache.set(cacheKey, plan);
      return plan;
    } catch (err: any) {
      console.warn(`[Gemini Recommendations] Call failed or validation rejected: ${err.message}. Using deterministic rule engine.`);
    }
  }

  // Deterministic Rule Engine Fallback
  const rulePlan = generateDeterministicRetentionPlan(customer);
  planCache.set(cacheKey, rulePlan);
  return rulePlan;
}

async function callGeminiWithValidation(
  customer: ScoredCustomer,
  modelVersion: string,
  dataHash: string
): Promise<RetentionPlan> {
  const ai = new GoogleGenAI({
    apiKey: SERVER_CONFIG.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Approved catalogue
  const catalogueSummary = SERVER_CONFIG.APPROVED_CATALOGUE.map((o) => ({
    id: o.id,
    name: o.name,
    category: o.category,
    oneOffCostGbp: o.oneOffCostGbp,
    monthlyDiscountGbp: o.monthlyDiscountGbp || 0,
    contractTermMonths: o.contractTermMonths || 0,
    idealFor: o.idealForDriver,
  }));

  // Strip protected attributes (Gender, Age) - strictly allowlisted inputs
  const customerProfileForAi = {
    customerId: customer.customerId,
    serviceType: customer.serviceType,
    planName: customer.planName,
    contractType: customer.contractType,
    autoRenew: customer.autoRenew,
    monthlyChargeGbp: customer.monthlyChargeGbp,
    averageMonthlyUsageGb: customer.averageMonthlyUsageGb,
    discountPercent: customer.discountPercent,
    directDebit: customer.directDebit,
    supportTickets12M: customer.supportTickets12M,
    complaints12M: customer.complaints12M,
    averageResolutionHours: customer.averageResolutionHours,
    networkOutages12M: customer.networkOutages12M,
    satisfactionScore: customer.satisfactionScore,
    npsScore: customer.npsScore,
    competitorOfferReceived: customer.competitorOfferReceived,
    calibratedChurnProbability: customer.churnProbability,
    riskTier: customer.riskTier,
    expectedMrrAtRiskGbp: customer.expectedMrrAtRiskGbp,
    personaName: customer.personaName,
    topRiskDrivers: customer.topRiskDrivers.map((d) => ({
      driver: d.label,
      value: d.value,
      baseline: d.baseline,
      impact: d.narrative,
    })),
  };

  const systemPrompt = `You are the Lead Churn Retention Strategist at BritConnect UK Telecom.
Generate a structured, hyper-personalized retention intervention for a customer based strictly on their actual risk drivers and our approved offer catalogue.
STRICT RULES:
1. You MUST select exactly ONE approved offer from the catalogue by offerId: [${SERVER_CONFIG.APPROVED_CATALOGUE.map((c) => c.id).join(', ')}].
2. Cap rule: Never offer a discount that exceeds ${SERVER_CONFIG.MAX_DISCOUNT_PERCENT_CAP}% or that cuts margins below cost.
3. Guardrail: If customer's top driver is Network Outages or Complaints, DO NOT offer a discount. Offer service resolution, speed boost, mesh WiFi hardware, or VIP care first.
4. Compliance: Do NOT mention or infer protected demographics (age, gender, ethnicity). Adhere strictly to UK GDPR & PECR opt-in rules.
Return output in strictly valid JSON conforming to the schema.`;

  const userPrompt = `Customer Profile:
${JSON.stringify(customerProfileForAi, null, 2)}

Approved Catalogue:
${JSON.stringify(catalogueSummary, null, 2)}

Generate the retention plan now.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headlineDiagnosis: { type: Type.STRING },
          rankedRootCauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rank: { type: Type.INTEGER },
                driver: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['rank', 'driver', 'explanation'],
            },
          },
          bestNextAction: {
            type: Type.OBJECT,
            properties: {
              actionTitle: { type: Type.STRING },
              offerId: { type: Type.STRING },
              channel: { type: Type.STRING },
              bestTiming: { type: Type.STRING },
              personalizedScript: { type: Type.STRING },
              talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              objectionHandling: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    objection: { type: Type.STRING },
                    counter: { type: Type.STRING },
                  },
                  required: ['objection', 'counter'],
                },
              },
              expectedSaveProbabilityMin: { type: Type.NUMBER },
              expectedSaveProbabilityMax: { type: Type.NUMBER },
              offerCostGbp: { type: Type.NUMBER },
              expectedNetValueGbp: { type: Type.NUMBER },
              escalationPath: { type: Type.STRING },
            },
            required: [
              'actionTitle',
              'offerId',
              'channel',
              'bestTiming',
              'personalizedScript',
              'talkingPoints',
              'objectionHandling',
              'expectedSaveProbabilityMin',
              'expectedSaveProbabilityMax',
              'offerCostGbp',
              'expectedNetValueGbp',
              'escalationPath',
            ],
          },
          doNotDoGuardrails: { type: Type.ARRAY, items: { type: Type.STRING } },
          gdprPecrNotice: { type: Type.STRING },
        },
        required: ['headlineDiagnosis', 'rankedRootCauses', 'bestNextAction', 'doNotDoGuardrails', 'gdprPecrNotice'],
      },
    },
  });

  const text = (response.text ?? '').trim();
  const parsed = JSON.parse(text);
  const validated = RetentionPlanZodSchema.parse(parsed);

  // Validate offer exists in catalogue
  const chosenOffer = SERVER_CONFIG.APPROVED_CATALOGUE.find((o) => o.id === validated.bestNextAction.offerId);
  if (!chosenOffer) {
    throw new Error(`Gemini suggested offerId ${validated.bestNextAction.offerId} which is not in the approved catalogue.`);
  }

  return {
    customerId: customer.customerId,
    generatedAt: new Date().toISOString(),
    engine: 'gemini',
    headlineDiagnosis: validated.headlineDiagnosis,
    rankedRootCauses: validated.rankedRootCauses,
    bestNextAction: {
      ...validated.bestNextAction,
      offer: chosenOffer,
    },
    doNotDoGuardrails: validated.doNotDoGuardrails,
    gdprPecrNotice: validated.gdprPecrNotice,
  };
}

// Deterministic Rule-Engine Fallback
export function generateDeterministicRetentionPlan(customer: ScoredCustomer): RetentionPlan {
  const topDriver = customer.topRiskDrivers[0]?.feature || '';
  let offer: RetentionOffer;
  let actionTitle = '';
  let channel: 'Call' | 'SMS' | 'Email' | 'App Notification' | 'Store Visit' = 'Call';
  let bestTiming = 'Within 48 hours, preferably between 14:00 - 17:00';
  let script = '';
  let talkingPoints: string[] = [];
  let doNotDo: string[] = [];

  if (topDriver.includes('outage') || topDriver.includes('resolution') || topDriver.includes('ticket')) {
    offer = SERVER_CONFIG.APPROVED_CATALOGUE.find((o) => o.id === 'OFFER_FIBRE_BOOST') || SERVER_CONFIG.APPROVED_CATALOGUE[0];
    actionTitle = 'Network Reliability Assurance & Complimentary Speed Boost';
    channel = 'Call';
    bestTiming = 'Immediate outreach by senior technical specialist';
    script = `Hello! I'm calling from BritConnect customer leadership. We noticed you experienced network friction recently and want to personally apologize and ensure your connection is performing flawlessly with a complimentary speed boost.`;
    talkingPoints = [
      'Acknowledge recent service disruption or tickets directly',
      'Explain infrastructure upgrades completed in their local exchange',
      'Offer zero-cost speed boost or WiFi mesh hardware to solidify coverage',
    ];
    doNotDo = [
      'Do NOT offer a generic price discount before acknowledging technical friction.',
      'Do NOT route this customer to an overseas tier-1 IVR queue.',
    ];
  } else if (topDriver.includes('competitor') || topDriver.includes('price')) {
    offer = SERVER_CONFIG.APPROVED_CATALOGUE.find((o) => o.id === 'OFFER_LOYALTY_10') || SERVER_CONFIG.APPROVED_CATALOGUE[1];
    actionTitle = 'Price-Lock Loyalty Guarantee & Tariff Alignment';
    channel = customer.monthlyChargeGbp > 50 ? 'Call' : 'Email';
    script = `Hi, BritConnect here. As a valued customer, we'd like to lock in a dedicated 10% loyalty discount on your monthly bill for the next 12 months with price-rise protection.`;
    talkingPoints = [
      'Highlight price lock guarantee against upcoming inflation adjustments',
      'Benchmark current plan value against competitor headline rates',
      'Simplify billing with optional paperless Direct Debit verification',
    ];
    doNotDo = [
      'Do NOT exceed the approved 25% discount margin cap.',
      'Do NOT downgrade service bandwidth to meet price expectations.',
    ];
  } else if (topDriver.includes('rolling') || topDriver.includes('term')) {
    offer = SERVER_CONFIG.APPROVED_CATALOGUE.find((o) => o.id === 'OFFER_LOYALTY_10') || SERVER_CONFIG.APPROVED_CATALOGUE[1];
    actionTitle = 'Fixed Commitment Reward Package';
    channel = 'App Notification';
    script = `Switch your rolling monthly connection to a fixed term today and receive your first month at 50% off plus guaranteed monthly savings.`;
    talkingPoints = [
      'Emphasize security of a fixed contract against annual CPI price rises',
      'Offer flexible early upgrade options after 9 months',
    ];
    doNotDo = [
      'Do NOT apply penalty fees if customer requests plan adjustments within 30 days.',
    ];
  } else {
    offer = SERVER_CONFIG.APPROVED_CATALOGUE.find((o) => o.id === 'OFFER_PRIORITY_VIP') || SERVER_CONFIG.APPROVED_CATALOGUE[4];
    actionTitle = 'Dedicated VIP Service Enrolment';
    channel = 'Call';
    script = `Hi, thank you for your ongoing partnership with BritConnect. We are enrolling your account into our VIP Priority Care group with dedicated phone access.`;
    talkingPoints = ['Direct priority access', 'Annual free health check of all router configurations'];
    doNotDo = ['Do NOT oversell unnecessary hardware bundles.'];
  }

  const expectedSaveProbMin = 0.35;
  const expectedSaveProbMax = 0.55;
  const offerCost = offer.oneOffCostGbp + (offer.monthlyDiscountGbp || 0) * 12;
  const expectedNetVal = Number((customer.monthlyChargeGbp * 12 * 0.45 - offerCost).toFixed(2));

  return {
    customerId: customer.customerId,
    generatedAt: new Date().toISOString(),
    engine: 'rule_fallback',
    headlineDiagnosis: `Elevated churn risk (${(customer.churnProbability * 100).toFixed(0)}%) driven primarily by ${customer.topRiskDrivers[0]?.label || 'tenure rolling terms'} in the ${customer.personaName} segment.`,
    rankedRootCauses: customer.topRiskDrivers.map((d, idx) => ({
      rank: idx + 1,
      driver: d.label,
      explanation: d.narrative,
    })),
    bestNextAction: {
      actionTitle,
      offer,
      channel,
      bestTiming,
      personalizedScript: script,
      talkingPoints,
      objectionHandling: [
        {
          objection: 'A competitor is offering a cheaper introductory rate.',
          counter: 'Our rate includes guaranteed UK-based support and our BritConnect price freeze with no mid-contract inflation spikes.',
        },
        {
          objection: 'I had poor connection reliability last month.',
          counter: 'We have provisioned priority line optimization and will install our complimentary WiFi booster to guarantee 100% room coverage.',
        },
      ],
      expectedSaveProbabilityMin: expectedSaveProbMin,
      expectedSaveProbabilityMax: expectedSaveProbMax,
      offerCostGbp: offerCost,
      expectedNetValueGbp: expectedNetVal,
      escalationPath: 'Escalate to Tier 2 Retention Team Lead if customer requests immediate PAC/STAC code.',
    },
    doNotDoGuardrails: doNotDo,
    gdprPecrNotice: 'Check marketing consent preferences in CRM before outbound telephone contact. Adhere strictly to UK PECR regulations.',
  };
}
