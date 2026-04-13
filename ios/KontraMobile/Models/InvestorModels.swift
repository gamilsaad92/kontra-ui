import Foundation

struct InvestorHolding: Codable, Identifiable {
    let loan_id: String
    let loan_ref: String
    let property_name: String
    let property_type: String?
    let location: String?
    let upb: Double
    let my_share_pct: Double
    let my_share_usd: Double
    let token_balance: Double
    let token_symbol: String?
    let status: String
    let yield_pct: Double
    let maturity: String?

    var id: String { loan_id }
}

struct InvestorDistribution: Codable, Identifiable {
    let id: String
    let period: String?
    let loan_ref: String?
    let gross_amount: Double
    let net_amount: Double
    let type: String
    let paid_at: String?
    let status: String
}

struct InvestorPerformance: Codable, Identifiable {
    let loan_ref: String
    let property: String?
    let dscr: Double
    let ltv: Double
    let delinquency_days: Int
    let payment_status: String
    let risk_label: String

    var id: String { loan_ref }
}

struct InvestorAlert: Codable, Identifiable {
    let id: String
    let severity: String
    let loan_ref: String?
    let message: String
    let created_at: String?
}

struct InvestorData {
    var holdings: [InvestorHolding]
    var distributions: [InvestorDistribution]
    var performance: [InvestorPerformance]
    var alerts: [InvestorAlert]
}

struct InvestorHoldingsResponse: Decodable { let holdings: [InvestorHolding] }
struct InvestorDistributionsResponse: Decodable { let distributions: [InvestorDistribution] }
struct InvestorPerformanceResponse: Decodable { let performance: [InvestorPerformance] }
struct InvestorAlertsResponse: Decodable { let alerts: [InvestorAlert] }
