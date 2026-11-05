import path from 'path';
import dotenv from 'dotenv';
import { RetentionOffer } from '../shared/types.js';

dotenv.config();

export const SERVER_CONFIG = {
  PORT: parseInt(process.env.DEFAULT_APP_PORT || '3000', 10),
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || '1sS3zh9SS8ptrAE-qg31L1lUNcb_PE6usl0pVucXU9_E',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY || '',
  DATA_DIR: path.resolve(process.cwd(), 'data'),
  CACHE_FILE: path.resolve(process.cwd(), 'data', 'snapshot_cache.json'),
  CAMPAIGNS_FILE: path.resolve(process.cwd(), 'data', 'campaigns.json'),
  AUDIT_LOG_FILE: path.resolve(process.cwd(), 'data', 'audit_log.json'),
  MAX_DISCOUNT_PERCENT_CAP: 25,
  APPROVED_CATALOGUE: [
    {
      id: 'OFFER_FIBRE_BOOST',
      name: 'Complimentary Ultrafast Speed Upgrade',
      category: 'speed',
      oneOffCostGbp: 15,
      description: 'Upgrade customer to the next broadband speed tier for 12 months with zero price rise.',
      idealForDriver: 'Network Outages / Usage Ceiling'
    },
    {
      id: 'OFFER_LOYALTY_10',
      name: '10% Retention Loyalty Discount (12M)',
      category: 'discount',
      monthlyDiscountGbp: 4.5,
      oneOffCostGbp: 0,
      contractTermMonths: 12,
      description: '10% monthly charge discount locked in exchange for a renewed 12-month contract commitment.',
      idealForDriver: 'Price Increase / Rolling Contract Risk'
    },
    {
      id: 'OFFER_LOYALTY_15',
      name: '15% High-Value Bundle Discount (24M)',
      category: 'discount',
      monthlyDiscountGbp: 8.5,
      oneOffCostGbp: 0,
      contractTermMonths: 24,
      description: '15% discount for high-value customers signing a 24-month fixed bundle agreement.',
      idealForDriver: 'Competitor Offer / High Monthly Spend'
    },
    {
      id: 'OFFER_MESH_WIFI',
      name: 'Free BritConnect Mesh WiFi Booster',
      category: 'hardware',
      oneOffCostGbp: 35,
      description: 'Deliver whole-home guaranteed WiFi coverage hardware unit free of charge.',
      idealForDriver: 'Support Tickets / Home WiFi Complaints'
    },
    {
      id: 'OFFER_PRIORITY_VIP',
      name: 'VIP Priority Care & Dedicated Account Manager',
      category: 'support',
      oneOffCostGbp: 10,
      description: 'Fast-track routing directly to Tier-2 senior UK support agents, bypassing IVR queues.',
      idealForDriver: 'Complaints / Long Resolution Times'
    },
    {
      id: 'OFFER_BUNDLE_SIM',
      name: 'Complimentary 20GB Mobile SIM Add-on',
      category: 'bundle',
      oneOffCostGbp: 5,
      contractTermMonths: 12,
      description: 'Add an extra mobile SIM with 20GB allowance free for a family member or business line.',
      idealForDriver: 'Cross-sell / Price-Sensitive Single Play'
    }
  ] as RetentionOffer[],
};
