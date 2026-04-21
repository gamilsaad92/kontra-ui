import Foundation

#if DEBUG
struct MockData {
    // ── Lender/Servicer dashboard ──────────────────────────────────────────
    static let overview: MobileOverview = {
        let summary = MobileOverview.Summary(
            totalApplications: 128,
            approvedApplications: 54,
            totalTasks: 42,
            pendingTasks: 9,
            averageCreditScore: 712,
            portfolioValue: 42_500_000,
            lastUpdated: Date()
        )

        let applications = (1...5).map { index in
            LoanApplication(
                id: index,
                name: "Borrower \(index)",
                amount: Double.random(in: 250_000...1_000_000),
                status: index % 2 == 0 ? "approved" : "under_review",
                decision: index % 2 == 0 ? "approve" : "review",
                submittedAt: Calendar.current.date(byAdding: .day, value: -index, to: Date()) ?? Date()
            )
        }

        let tasks = (1...5).map { index in
            TaskItem(
                id: index,
                title: "Review financial package #\(index)",
                priority: index == 1 ? "urgent" : "normal",
                status: index == 3 ? "completed" : "pending",
                dueDate: Calendar.current.date(byAdding: .day, value: index, to: Date()),
                owner: index % 2 == 0 ? "Alex" : "Jordan"
            )
        }

        let alerts = (1...3).map { index in
            RiskAlert(
                id: index,
                loanID: 400 + index,
                severity: index == 1 ? "high" : "medium",
                message: "Payment delinquent for asset #\(400 + index)",
                createdAt: Calendar.current.date(byAdding: .hour, value: -index * 6, to: Date()) ?? Date()
            )
        }

        let activity = applications.enumerated().map { offset, app in
            MobileOverview.Activity(
                id: "app-\(app.id)",
                type: .application,
                title: "\(app.name) submitted",
                detail: "Status: \(app.status.capitalized)",
                timestamp: app.submittedAt.addingTimeInterval(Double(offset) * 600)
            )
        }

        return MobileOverview(
            summary: summary,
            applications: applications,
            tasks: tasks,
            alerts: alerts,
            activity: activity,
            suggestion: "Review the pending underwriting tasks for highest risk loans."
        )
    }()

    // ── Borrower portal ────────────────────────────────────────────────────
    static let borrowerData = BorrowerData(
        loan: BorrowerLoan(
            loan_ref: "LN-2847",
            property_name: "The Meridian Apartments",
            property_address: "412 Meridian Blvd, Austin, TX 78701",
            property_type: "Multifamily — 24 units",
            maturity_date: "2026-09-01",
            current_balance: 4_112_500,
            original_balance: 4_200_000,
            interest_rate: "8.75%",
            payment_type: "Interest Only",
            status: "Current",
            next_payment_date: "2026-05-01",
            next_payment_amount: 29_968.75,
            servicer_name: "Kontra Capital Servicing",
            servicer_contact: "servicing@kontraplatform.com"
        ),
        payments: [
            BorrowerPayment(id:"p1", date:"2026-04-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid"),
            BorrowerPayment(id:"p2", date:"2026-03-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid"),
            BorrowerPayment(id:"p3", date:"2026-02-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid"),
            BorrowerPayment(id:"p4", date:"2026-01-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid"),
        ],
        documents: [
            BorrowerDocument(id:"d1", name:"Monthly Operating Statement", due:"2026-04-30", status:"submitted", submitted_at:"2026-04-08", notes:"Under lender review"),
            BorrowerDocument(id:"d2", name:"Q1 2026 Rent Roll", due:"2026-04-15", status:"approved", submitted_at:"2026-04-10", notes:nil),
            BorrowerDocument(id:"d3", name:"Property Insurance Renewal", due:"2026-05-15", status:"pending", submitted_at:nil, notes:"Policy expires May 31"),
            BorrowerDocument(id:"d4", name:"Draw #5 Inspection Documentation", due:"2026-05-01", status:"pending", submitted_at:nil, notes:"Required for next draw"),
        ],
        draws: [
            BorrowerDraw(id:"dr1", number:"Draw #4", amount:340000, purpose:"Phase 2 — unit renovation (units 13–18)", status:"funded", submitted_at:"2026-03-20", funded_at:"2026-04-01", inspector_approved:true),
            BorrowerDraw(id:"dr2", number:"Draw #5 (Pending)", amount:310000, purpose:"Phase 3 — units 19–24 + common area", status:"pending_inspection", submitted_at:"2026-04-05", funded_at:nil, inspector_approved:false),
        ],
        notices: [
            BorrowerNotice(id:"n1", type:"informational", subject:"Draw #5 Inspection Scheduled", body:"An inspection for Draw #5 has been scheduled for April 22, 2026.", date:"2026-04-08", from:"Kontra Servicing"),
            BorrowerNotice(id:"n2", type:"action_required", subject:"Monthly Operating Statement Due", body:"Your Monthly Operating Statement is due by April 30.", date:"2026-04-01", from:"Kontra Servicing"),
        ]
    )

    // ── Investor portal ────────────────────────────────────────────────────
    static let investorData = InvestorData(
        holdings: [
            InvestorHolding(loan_id:"ln1", loan_ref:"LN-2847", property_name:"The Meridian Apartments", property_type:"Multifamily", location:"Austin, TX", upb:4200000, my_share_pct:24.5, my_share_usd:1029000, token_balance:10290, token_symbol:"KTRA-2847", status:"Current", yield_pct:8.75, maturity:"2026-09-01"),
            InvestorHolding(loan_id:"ln2", loan_ref:"LN-3011", property_name:"Harbor Blvd Retail", property_type:"Retail", location:"San Diego, CA", upb:2800000, my_share_pct:24.5, my_share_usd:686000, token_balance:6860, token_symbol:"KTRA-3011", status:"Special Servicing", yield_pct:11.5, maturity:"2025-12-01"),
            InvestorHolding(loan_id:"ln3", loan_ref:"LN-2741", property_name:"Westgate Industrial Park", property_type:"Industrial", location:"Phoenix, AZ", upb:6100000, my_share_pct:24.5, my_share_usd:1494500, token_balance:14945, token_symbol:"KTRA-2741", status:"Current", yield_pct:7.9, maturity:"2027-03-01"),
        ],
        distributions: [
            InvestorDistribution(id:"d1", period:"April 2026", loan_ref:"LN-2847", gross_amount:8920.63, net_amount:8027.00, type:"Interest", paid_at:"2026-04-01", status:"paid"),
            InvestorDistribution(id:"d2", period:"April 2026", loan_ref:"LN-2741", gross_amount:12150.00, net_amount:10935.00, type:"Interest", paid_at:"2026-04-01", status:"paid"),
            InvestorDistribution(id:"d3", period:"May 2026",   loan_ref:"LN-2847", gross_amount:8920.63, net_amount:8027.00, type:"Interest", paid_at:"2026-05-01", status:"scheduled"),
        ],
        performance: [
            InvestorPerformance(loan_ref:"LN-2847", property:"Meridian Apartments", dscr:1.42, ltv:68.2, delinquency_days:0, payment_status:"Current", risk_label:"Low"),
            InvestorPerformance(loan_ref:"LN-3011", property:"Harbor Blvd Retail", dscr:0.94, ltv:88.5, delinquency_days:45, payment_status:"Default", risk_label:"High"),
            InvestorPerformance(loan_ref:"LN-2741", property:"Westgate Industrial", dscr:1.68, ltv:52.1, delinquency_days:0, payment_status:"Current", risk_label:"Low"),
        ],
        alerts: [
            InvestorAlert(id:"a1", severity:"high", loan_ref:"LN-3011", message:"Loan in special servicing — 45 days delinquent. Foreclosure proceedings initiated.", created_at:"2026-04-06T08:00:00Z"),
            InvestorAlert(id:"a2", severity:"medium", loan_ref:"LN-3204", message:"DSCR declined to 1.21x (covenant floor 1.20x). Under review by asset manager.", created_at:"2026-04-02T10:30:00Z"),
        ]
    )
}
#endif
