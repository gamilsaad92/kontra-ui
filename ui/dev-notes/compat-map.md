 Feature | Old UI Function/Hook | HTTP Method | Path | Request Type | Response Type | Used In Files |
| --- | --- | --- | --- | --- | --- | --- |
| applications | handleAutoFill | POST | /api/loan-applications/auto-fill | FormData {document} | { fields: Record<string,string> } | ui/src/components/LoanApplicationForm.jsx |
| applications | handleSubmit | POST | /api/loan-applications | FormData {name,email,ssn,amount,document?} | { application: any } | ui/src/components/LoanApplicationForm.jsx |
| applications | useEffect load | GET | /api/loan-applications | none | { applications: any[] } | ui/src/components/LoanApplicationList.jsx |
| applications | listPipeline service | GET | /applications?limit=6 | none | any[] | ui/src/services/servicing.ts |
| applications | useEffect load | GET | /api/my-applications?email={email} | none | { applications: any[] } | ui/src/components/CustomerPortal.jsx |
| loans | useEffect fetchLoans | GET | /api/loans?{params} | query params | { loans: any[] } | ui/src/components/LoanList.jsx |
| loans | changeStatus | POST | /api/loans/batch-update | JSON {ids,status} | none | ui/src/components/LoanList.jsx |
| loans | getSavedQueries | GET | /api/saved-loan-queries | header x-user-id | { queries: any[] } | ui/src/components/LoanList.jsx |
| loans | saveCurrent | POST | /api/saved-loan-queries | JSON {name,query} | none | ui/src/components/LoanList.jsx |
| loans | handleSubmit | POST | /api/loans | JSON {borrower_name,amount,interest_rate,term_months,start_date} | { message?, loan? } | ui/src/components/CreateLoanForm.jsx |
| loans | useEffect loadDetails | GET | /api/loans/{loanId}/details | none | { ...loan } | ui/src/components/LoanDetailPanel.jsx |
| loans | useEffect recentActivity | GET | /api/loans | none | { loans: any[] } | ui/src/components/RecentActivityTable.jsx |
| loans | useEffect userLoans | GET | /api/my-loans?user_id={id} | none | { loans: any[] } | ui/src/components/CustomerPortal.jsx |
| draw_requests | fetchDraws | GET | /api/get-draws | none | { draws: any[] } | ui/src/components/DrawKanbanBoard.jsx<br>ui/src/components/DrawRequestsTable.jsx |
| draw_requests | reviewDraw | POST | /api/review-draw | JSON {id,status[,comment]} | none | ui/src/components/DrawKanbanBoard.jsx<br>ui/src/components/DrawRequestDetail.jsx |
| draw_requests | getDrawRequest | GET | /api/draw-requests/{drawId} | none | { draw: any } | ui/src/components/DrawRequestDetail.jsx |
| draw_requests | exportDraws | GET | /api/draw-requests/export?{params} | query params | CSV text | ui/src/components/DrawRequestsTable.jsx |
| draw_requests | getHistory | GET | /api/draw-requests/{drawId}/history | none | { history: any[] } | ui/src/components/DrawStatusTracker.jsx |
| draw_requests | submitDraw | POST | /api/draw-requests | FormData {project,draw_number,description,amount,documents[]} | { draw: {id} } | ui/src/components/DrawRequestForm.jsx |
| draw_requests | documentReview | POST | /api/document-review/process | FormData {file,doc_type} | { extracted: any } | ui/src/components/DrawRequestForm.jsx |
| draw_requests | selfServeSubmit | POST | /api/draw-request | JSON {project,project_number,property_location,amount,description} | message | ui/src/components/SelfServeDrawRequestForm.jsx |
| draw_requests | drawSummary | GET | /api/draw-requests/{id}/summary[?email={email}] | query email optional | PDF or message | ui/src/components/DashboardHome.jsx |
| draw_requests | waiverChecklist | GET | /api/waiver-checklist/{drawId} | none | { checklist: any[] } | ui/src/components/LienWaiverChecklist.jsx |
| draw_requests | validateDraw | POST | /api/validate-draw | JSON {budget,invoices,waiver,previousDraws} | { recommendation: string } | ui/src/components/DrawReviewForm.jsx |
| escrows | useEffect load | GET | /api/escrows/upcoming | none | { escrows: any[] } | ui/src/components/EscrowDashboard.jsx |
| escrows | pay | POST | /api/loans/{loanId}/escrow/pay | JSON {type,amount} | message | ui/src/components/EscrowDashboard.jsx |
| servicing | useEffect nextDue | GET | /api/next-due | none | { next_due: {due_date:string,days_until:number} } | ui/src/modules/dashboard/NextDueCard.jsx |
| servicing | createPortal | POST | /api/loans/{loanId}/payment-portal | JSON {amount} | { url: string } | ui/src/components/PaymentPortalEmbed.jsx |
| servicing | fetchBalance | GET | /api/loans/{loanId}/balance | none | { balance: string } | ui/src/components/SelfServicePayment.jsx |
| servicing | calcPayoff | POST | /api/loans/{loanId}/payoff | JSON {payoff_date} | { payoff: string } | ui/src/components/SelfServicePayment.jsx |
| servicing | fetchPayments | GET | /api/loans/{loanId}/payments | none | { payments: any[] } | ui/src/components/PaymentHistory.jsx |
| servicing | generateSchedule | POST | /api/loans/{loanId}/generate-schedule | none | none | ui/src/components/AmortizationTable.jsx |
| servicing | fetchSchedule | GET | /api/loans/{loanId}/schedule | none | { schedule: any[] } | ui/src/components/AmortizationTable.jsx |
| servicing | sendPayoffQuote | POST | /loans/{loanId}/payoff-quote | JSON {} | any | ui/src/services/servicing.ts |
| analytics | getPortfolioSnapshot | POST | /portfolio-summary | JSON {period} | { delinquency_pct:number,spark:number[] } | ui/src/services/analytics.ts |
| analytics | getRiskSummary | GET | /risk/run | none | { buckets: {label:string,value:number}[] } | ui/src/services/analytics.ts |
| analytics | getRoiSeries | GET | /investor-reports?series=roi | none | { roi: number[] } | ui/src/services/analytics.ts |
| analytics | loadOffers | POST | /api/suggest-upsells | JSON {guest_id} | { suggestions: string[] } | ui/src/modules/dashboard/OfferCard.jsx |
| analytics | customFeed | GET | {url} | none | any | ui/src/modules/dashboard/CustomFeedCard.jsx |
| analytics | rpc get_draws_volume | RPC | get_draws_volume | none | any[] | ui/src/components/AnalyticsDashboard.jsx |
| analytics | query loans table | SELECT | loans (group by status) | none | any[] | ui/src/components/AnalyticsDashboard.jsx |
| analytics | runQuery | POST | /api/query-loans | JSON {query} | { loans: any[] } | ui/src/components/LoanQueryWidget.jsx |
| users/auth | handleLogin password | POST | supabase.auth.signInWithPassword | { email, password } | { session | error } | ui/src/components/LoginForm.jsx |
| users/auth | handleLogin magic | POST | supabase.auth.signInWithOtp | { email, options } | { session | error } | ui/src/components/LoginForm.jsx |
| users/auth | handleSignUp password | POST | supabase.auth.signUp | { email, password, options } | { user | error } | ui/src/components/SignUpForm.jsx |
| users/auth | handleSignUp magic | POST | supabase.auth.signInWithOtp | { email, options } | { user | error } | ui/src/components/SignUpForm.jsx |
| users/auth | useEffect loadInvite | GET | /api/invites/{token} | none | { invite } | ui/src/components/InviteAcceptForm.jsx |
| users/auth | handleSubmit inviteAccept | POST | /api/invites/accept | JSON {token,password} | { error? } | ui/src/components/InviteAcceptForm.jsx |
