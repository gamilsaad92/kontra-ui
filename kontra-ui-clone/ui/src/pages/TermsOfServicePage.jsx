import React from 'react';
import { useNavigate } from 'react-router-dom';

const YEAR = new Date().getFullYear();

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#111', color: '#ccc' }}>
      <div className="mx-auto max-w-3xl px-6 py-16">

        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-xs font-medium uppercase tracking-widest transition-colors"
          style={{ color: '#800020' }}
          onMouseEnter={e => e.currentTarget.style.color = '#b83550'}
          onMouseLeave={e => e.currentTarget.style.color = '#800020'}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#800020' }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: '-0.05em' }}>K</span>
          </div>
          <span className="text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Kontra</span>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
          Terms of Service
        </h1>
        <p className="mb-10 text-sm" style={{ color: '#555' }}>
          Last updated: April {YEAR} &nbsp;·&nbsp; Effective upon first use of the platform
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#999' }}>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Proprietary Software</h2>
            <p>
              Kontra (the "Platform") is proprietary software owned exclusively by Kontra Technologies, Inc.
              ("Company," "we," "us," or "our"). All source code, algorithms, data models, user interface designs,
              API specifications, documentation, and related intellectual property embodied in the Platform are
              protected by United States and international copyright law, trade secret law, and other applicable
              intellectual property statutes.
            </p>
            <p className="mt-3">
              No license, right, or interest in the Platform's source code or underlying technology is granted to
              you by virtue of accessing or using the Platform. You may not copy, reproduce, distribute, reverse
              engineer, decompile, disassemble, create derivative works from, sublicense, sell, or otherwise
              exploit any portion of the Platform without the prior written consent of Kontra Technologies, Inc.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. License Grant</h2>
            <p>
              Subject to your compliance with these Terms, Kontra grants you a limited, non-exclusive,
              non-transferable, non-sublicensable, revocable license to access and use the Platform solely
              for your internal business purposes as a commercial real estate loan servicer, lender, investor,
              or borrower, as applicable to your assigned role. This license does not include the right to:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Resell, white-label, or provide access to the Platform to third parties</li>
              <li>Reproduce or duplicate any portion of the Platform</li>
              <li>Use the Platform to develop competing software or services</li>
              <li>Remove or alter any proprietary notices, labels, or marks</li>
              <li>Access the Platform through automated means not approved by Kontra</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Confidentiality</h2>
            <p>
              All information accessed through the Platform, including but not limited to loan data, borrower
              information, financial records, underwriting parameters, pricing models, and system architecture,
              constitutes confidential and proprietary information of Kontra and its clients. You agree to:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Keep all Platform information strictly confidential</li>
              <li>Use Platform information only for authorized business purposes</li>
              <li>Not disclose Platform information to any third party without prior written consent</li>
              <li>Implement reasonable security measures to protect Platform information</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Data Security & Compliance</h2>
            <p>
              You are responsible for maintaining the security of your account credentials. You must notify
              Kontra immediately upon discovering any unauthorized access or suspected breach. The Platform
              is designed to assist with regulatory compliance; however, you remain solely responsible for
              ensuring your use of the Platform complies with all applicable laws and regulations, including
              without limitation the Bank Secrecy Act, RESPA, TILA, GLBA, applicable state lending laws,
              and any applicable SEC regulations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable law or regulation</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform</li>
              <li>Introduce any malicious code, virus, or harmful component into the Platform</li>
              <li>Scrape, crawl, or systematically extract data from the Platform</li>
              <li>Use the Platform to facilitate money laundering, fraud, or any criminal enterprise</li>
              <li>Share account credentials with any unauthorized person</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Intellectual Property Ownership</h2>
            <p>
              All intellectual property rights in the Platform — including patents, copyrights, trademarks,
              trade secrets, and any other proprietary rights — are and shall remain the exclusive property
              of Kontra Technologies, Inc. Any feedback, suggestions, or improvements you provide regarding
              the Platform are hereby assigned to Kontra Technologies, Inc. without restriction and without
              any obligation of compensation to you.
            </p>
            <p className="mt-3">
              "Kontra," the Kontra logo, and all related marks are trademarks of Kontra Technologies, Inc.
              You may not use these marks without our prior written permission.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EITHER
              EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KONTRA TECHNOLOGIES,
              INC. EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING WITHOUT LIMITATION, IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
              THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL KONTRA TECHNOLOGIES,
              INC. BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN
              CONNECTION WITH THESE TERMS OR YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY TO YOU SHALL
              NOT EXCEED THE AMOUNTS PAID BY YOU TO KONTRA IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Governing Law & Disputes</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of
              Delaware, without regard to its conflict of law provisions. Any dispute arising under or
              relating to these Terms shall be resolved by binding arbitration in accordance with the
              Commercial Arbitration Rules of the American Arbitration Association, conducted in
              New York, New York.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Modifications</h2>
            <p>
              Kontra Technologies, Inc. reserves the right to modify these Terms at any time. Material
              changes will be communicated via the Platform or email. Continued use of the Platform after
              the effective date of any modification constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">11. Contact</h2>
            <p>
              Questions regarding these Terms should be directed to:
              <br /><br />
              <span className="text-white">Kontra Technologies, Inc.</span><br />
              Legal Department<br />
              <a href="mailto:legal@kontraplatform.com" style={{ color: '#800020' }}>legal@kontraplatform.com</a>
            </p>
          </section>

        </div>

        <div
          className="mt-16 border-t pt-8 text-center text-xs"
          style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#444' }}
        >
          © {YEAR} Kontra Technologies, Inc. All rights reserved.<br />
          This software and its contents are proprietary and confidential.
        </div>

      </div>
    </div>
  );
}
