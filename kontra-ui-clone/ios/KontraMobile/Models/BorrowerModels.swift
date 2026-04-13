import Foundation

struct BorrowerLoan: Codable, Identifiable {
    var id: String { loan_ref }
    let loan_ref: String
    let property_name: String
    let property_address: String?
    let property_type: String?
    let maturity_date: String?
    let current_balance: Double?
    let original_balance: Double?
    let interest_rate: String?
    let payment_type: String?
    let status: String?
    let next_payment_date: String?
    let next_payment_amount: Double?
    let servicer_name: String?
    let servicer_contact: String?
}

struct BorrowerPayment: Codable, Identifiable {
    let id: String
    let date: String
    let amount: Double
    let principal: Double
    let interest: Double
    let late_fee: Double
    let status: String
}

struct BorrowerDocument: Codable, Identifiable {
    let id: String
    let name: String
    let due: String?
    let status: String
    let submitted_at: String?
    let notes: String?
}

struct BorrowerDraw: Codable, Identifiable {
    let id: String
    let number: String
    let amount: Double
    let purpose: String
    let status: String
    let submitted_at: String?
    let funded_at: String?
    let inspector_approved: Bool
}

struct BorrowerNotice: Codable, Identifiable {
    let id: String
    let type: String
    let subject: String
    let body: String
    let date: String?
    let from: String?
}

struct BorrowerData {
    var loan: BorrowerLoan?
    var payments: [BorrowerPayment]
    var documents: [BorrowerDocument]
    var draws: [BorrowerDraw]
    var notices: [BorrowerNotice]
}

struct BorrowerLoanResponse: Decodable { let loan: BorrowerLoan? }
struct BorrowerPaymentsResponse: Decodable { let payments: [BorrowerPayment] }
struct BorrowerDocumentsResponse: Decodable { let documents: [BorrowerDocument] }
struct BorrowerDrawsResponse: Decodable { let draws: [BorrowerDraw] }
struct BorrowerNoticesResponse: Decodable { let notices: [BorrowerNotice] }
