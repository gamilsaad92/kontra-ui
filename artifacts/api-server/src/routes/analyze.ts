import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SAMPLE_DOCUMENTS: Record<string, string> = {
  "rent-roll": `
RENT ROLL — ARBOR CROSSING APARTMENTS
Property: Arbor Crossing Apartments, 4820 Peachtree Industrial Blvd, Atlanta, GA 30341
Loan ID: KNT-2024-0847 | Loan Balance: $12,500,000 | Loan Type: CMBS Bridge
As of: March 31, 2024

UNIT SUMMARY:
Total Units: 148 | Occupied: 108 | Vacant: 40
Physical Occupancy: 72.97%
Economic Occupancy: 68.2%
Gross Potential Rent (GPR): $187,400/mo
Effective Gross Income (EGI): $127,700/mo

UNIT BREAKDOWN:
Studio (18 units): 14 occupied @ $875/mo avg. 4 vacant.
1BR/1BA (72 units): 52 occupied @ $1,125/mo avg. 20 vacant (8 down for renovation — HVAC).
2BR/2BA (48 units): 34 occupied @ $1,395/mo avg. 14 vacant.
3BR/2BA (10 units): 8 occupied @ $1,750/mo avg. 2 vacant.

DELINQUENCIES:
- Unit 204: 62 days past due — $2,250 owed. Eviction filed.
- Unit 317: 31 days past due — $1,125 owed. Payment plan in place.
- Unit 412: 90+ days past due — $4,185 owed. Legal proceedings ongoing.

NOTES:
- 8 units in 1BR building offline since Jan 2024 for HVAC replacement (completion est. June 2024).
- 3 units held off-market as model/leasing office (Units 101, 102, 103).
- $145,000 in hazard reserve fund; $38,500 disbursed for emergency roof repair Feb 2024 — approval pending from servicer.
- Annualized NOI: $842,400 (below underwritten $1,050,000 due to vacancies)
- Debt Service (annual): $905,000
- DSCR: 0.93x (below 1.20x covenant)
  `,

  "inspection": `
PROPERTY INSPECTION REPORT
Property: Westgate Commerce Center
Address: 2100 Commerce Pkwy, Columbus, OH 43219
Loan ID: KNT-2023-1102 | Loan Balance: $8,750,000
Inspection Date: April 5, 2024 | Inspector: M. Thornton, PE (LicNo: OH-PE-48821)

EXECUTIVE SUMMARY:
Westgate Commerce Center is a 127,500 SF Class B industrial/flex property built in 1989. The property is 91% leased (115,875 SF occupied across 6 tenants). Physical condition is FAIR with deferred maintenance items requiring immediate attention.

CRITICAL FINDINGS (Immediate Action Required):
1. ROOF — Building C (24,000 SF): Active leaks in 3 locations. Temporary patches applied. Full replacement estimated $385,000. Current reserve balance: $42,000. DEFICIT: $343,000. Risk: tenant lease allows rent abatement if not remediated within 90 days.
2. HVAC — Units 4 & 5: RTU units (2017, 2019) showing refrigerant loss. Replacement cost est. $62,000. Tenant ACME Logistics (largest tenant — 38,000 SF, expires July 2025) has notified intent to vacate if systems not replaced by June 30, 2024.
3. FIRE SUPPRESSION — Building A: Annual inspection overdue by 14 months. Jurisdiction (Columbus Fire Dept) has issued notice of violation (NOV-2024-0312). $5,000 fine assessed. Certificate of Occupancy at risk.

MODERATE FINDINGS (Action within 90 days):
- Parking lot resurfacing required (section C): Est. $88,000
- Loading dock seals replacement (Bays 7-12): Est. $24,000
- Exterior LED lighting upgrade (code requirement by Dec 2024): Est. $31,000

TENANT STATUS:
- ACME Logistics (38,000 SF): At risk — vacate notice if HVAC not resolved.
- Metro Distributing (22,000 SF): Current, lease expires 2027.
- 4 smaller tenants (55,875 SF combined): Current, mixed lease terms 2024-2026.

IMMEDIATE COMPLIANCE CONCERNS:
- Fire suppression violation creates potential for City to issue Stop-Use Order.
- ACME vacate risk drops occupancy from 91% to 61% — triggers covenant violation.
  `,

  "financials": `
OPERATING STATEMENT — MERIDIAN PLAZA OFFICE
Property: Meridian Plaza, 550 N. Lake Shore Dr., Chicago, IL 60611
Loan ID: KNT-2024-0234 | Loan Balance: $32,400,000 | Loan Type: Permanent
Period: January 1 – December 31, 2023

INCOME:
Base Rent: $4,820,400
Expense Reimbursements (CAM/Tax/Insurance): $612,000
Parking Revenue: $218,000
Other Income: $44,600
GROSS REVENUE: $5,695,000
Less Vacancy & Credit Loss (11.2%): ($638,000)
EFFECTIVE GROSS INCOME (EGI): $5,057,000

EXPENSES:
Real Estate Taxes: $892,000
Insurance: $124,000
Utilities: $318,000
Management Fee (4% EGI): $202,280
Repairs & Maintenance: $385,000
Janitorial: $156,000
Security: $98,000
Administrative: $62,000
Capital Reserves: $255,000
TOTAL OPERATING EXPENSES: $2,492,280

NET OPERATING INCOME (NOI): $2,564,720
Underwritten NOI: $2,900,000 (VARIANCE: -$335,280 / -11.6%)

DEBT SERVICE:
Annual Debt Service: $2,102,400 (P+I on $32.4M @ 5.45%, 25yr amort)
DSCR: 1.22x (Covenant: 1.25x minimum — BELOW THRESHOLD)

OCCUPANCY: 88.8% (151,200 SF occupied of 170,400 SF total)
- Floor 12 (14,400 SF): Vacant since Nov 2022 — former anchor tenant ComCo departed.
- Floor 8 partial (4,800 SF): Short-term tenant, lease expired March 2024.

CASH FLOW NOTES:
- R&M spike due to elevator modernization ($185,000) — one-time capex.
- Management fee rebid in progress — expected savings of $40,000/yr starting Q2 2024.
- Lease renewal negotiations ongoing for 3 tenants (42,000 SF total) — renewal probability est. 70%.
- Hazard reserve: $890,000 on hand. $0 disbursed YTD 2024.
  `,
};

const ANALYSIS_PROMPT = `You are a senior CRE loan servicer AI. Analyze the following commercial real estate document and extract structured data. Be precise and realistic based on the document content.

Return a JSON object with this exact structure:
{
  "property": {
    "name": string,
    "address": string,
    "type": string (e.g. "Multifamily", "Industrial/Flex", "Office"),
    "loanId": string,
    "loanBalance": number (in dollars),
    "loanType": string
  },
  "metrics": {
    "occupancy": number (percentage 0-100),
    "dscr": number (e.g. 1.22),
    "noi": number (annual, in dollars),
    "debtService": number (annual, in dollars),
    "ltv": number (percentage, estimate if not given),
    "noiVariance": number (percentage vs underwritten, negative if below)
  },
  "aiSummary": string (2-3 sentences summarizing the loan status, key concerns, and overall risk posture. Be direct and professional),
  "risks": [
    {
      "level": "HIGH" | "MEDIUM" | "LOW",
      "category": string (e.g. "Occupancy", "DSCR", "Delinquency", "Physical Condition", "Tenant Concentration", "Compliance"),
      "description": string (specific, factual),
      "trigger": string (what threshold or event triggered this flag)
    }
  ],
  "complianceFlags": [
    {
      "type": "WATCHLIST" | "VIOLATION" | "NOTICE",
      "description": string,
      "action": string (recommended immediate action),
      "deadline": string (if applicable, e.g. "June 30, 2024")
    }
  ],
  "issues": [string] (list of 3-5 specific property or loan issues found),
  "recommendedActions": [string] (list of 4-6 specific recommended servicer actions),
  "workflow": {
    "type": "draw-request" | "compliance-checklist",
    "title": string,
    "items": [
      {
        "id": string,
        "label": string,
        "status": "complete" | "in-progress" | "required" | "pending",
        "responsible": string (e.g. "Borrower", "Servicer", "Inspector", "Legal"),
        "dueDate": string (e.g. "May 15, 2024"),
        "auditNote": string (brief note for audit trail)
      }
    ]
  },
  "tokenization": {
    "poolValue": number (estimated property value in dollars),
    "loanBalance": number,
    "investorShares": number (e.g. 1000),
    "shareValue": number (loanBalance / investorShares),
    "projectedCashFlow": number (estimated monthly distribution per share based on NOI),
    "yieldRate": number (percentage, annualized),
    "riskRating": string (e.g. "B+", "BB-", "A-"),
    "status": "STANDARDIZED" | "PENDING_REMEDIATION" | "WATCHLIST"
  }
}

Generate 3-5 risks based on the actual document data. For workflow, if there are reserve/draw issues use "draw-request" type with 6-8 items; if compliance issues dominate, use "compliance-checklist". Make all items realistic and specific to this property. Only return valid JSON, no markdown.`;

router.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    let documentText = "";

    if (req.file) {
      documentText = req.file.buffer.toString("utf-8");
    } else if (req.body.sampleType && SAMPLE_DOCUMENTS[req.body.sampleType]) {
      documentText = SAMPLE_DOCUMENTS[req.body.sampleType];
    } else {
      return res.status(400).json({ error: "Provide a file upload or a valid sampleType" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `DOCUMENT:\n${documentText.slice(0, 12000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const analysis = JSON.parse(raw);
    res.json({ success: true, analysis });
  } catch (err: any) {
    console.error("[analyze] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
