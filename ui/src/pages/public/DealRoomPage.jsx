tyId}`)));
    } catch {}
  }, [propertyId]);

  // After a room loads, ask AI whether the stored pack matches the transaction.
  // Only runs for coordinator view of live (non-demo) rooms with a standard built-in pack.
  // Custom ws_* packs are always intentional — never suggest a change for those.
  useEffect(() => {
    if (!apiProperty || DEMO_PROPERTIES[propertyId]) return;
    const stored = apiProperty.workflow_pack_id;
    if (!stored || stored.startsWith('ws_')) return;
    fetch(`${API_BASE}/api/public/classify-pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: apiProperty.property_name,
        dealType: apiProperty.deal_type,
        address: apiProperty.address,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.packId && data.packId !== stored) {
          setPackSuggestion({ suggestedPack: data.packId, currentPack: stored });
        }
      })
      .catch(() => {});
  }, [apiProperty?.property_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRepack(acceptedPackId) {
    setRepackLoading(true);
    setPackSuggestion(null);
    try {
      // Read the owner token stored at checkout — same credential used by the checklist PUT
      let ownerWriteToken = '';
      try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}

      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/repack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: acceptedPackId, ownerWriteToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[repack]', data.error);
        setRepackLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setRepackLoading(false);
    }
  }

  async function handleActivate() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const property = DEMO_PROPERTIES[propertyId] || apiProperty;
      const res = await fetch(`${API_BASE}/api/checkout/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "deal", propertyId, propertyName: property?.property_name || property?.name, role }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Stripe not configured") {
        window.location.href = `mailto:hello@kontraplatform.com?subject=Activate Deal Room — ${propertyId}`;
      } else {
        setCheckoutError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setCheckoutError("Network error — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleDemoActivate() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const property = DEMO_PROPERTIES[propertyId] || apiProperty;
      const res = await fetch(`${API_BASE}/api/checkout/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "deal",
          propertyId,
          propertyName: property?.property_name || property?.name || propertyId,
          email: "dev@kontraplatform.com",
          role: "owner",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Demo activation failed.");
      }
    } catch {
      setCheckoutError("Network error — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Resolve property: demo first, then API, then derive from slug
  const demoProperty = DEMO_PROPERTIES[propertyId];
  const isCustom = !demoProperty;

  // Build display property object
  let property = demoProperty;
  if (!property && apiProperty) {
    const sample = generateDemoData(apiProperty);
    property = {
      ...apiProperty,
      ...sample,
      name: apiProperty.property_name,
      type: apiProperty.property_type || "Commercial",
      market: apiProperty.address?.split(",").slice(-2).join(",").trim() || "",
      image: TYPE_IMAGES[apiProperty.property_type] || DEFAULT_IMAGE,
      isCustom: true,
    };
  } else if (!property && !loadingApi) {
    const derivedName = propertyId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const sample = generateDemoData({ property_type: "Multifamily", deal_amount: "" });
    property = {
      ...sample,
      id: propertyId,
      name: derivedName,
      type: "Commercial", market: "",
      address: "", image: DEFAULT_IMAGE,
      isCustom: true,
      property_type: "", property_size: "", deal_type: "", deal_amount: "",
    };
  }

  const isDemo = ['kontra-demo', 'kontra-demo-biz', 'kontra-demo-fundraising'].includes(propertyId);

  // Per-demo hero image overrides — each room gets a visually appropriate photo
  if (propertyId === 'kontra-demo' && property) {
    property.image = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80";
    property.market = "Miami, FL";
    property.deal_amount = property.deal_amount || "14,000,000";
  }
  if (propertyId === 'kontra-demo-biz' && property) {
    property.image = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80";
    property.market = "Austin, TX";
    property.deal_amount = property.deal_amount || "8,500,000";
  }
  if (propertyId === 'kontra-demo-fundraising' && property) {
    property.image = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80";
    property.market = "San Francisco, CA";
    property.deal_amount = property.deal_amount || "42,000,000";
  }

  // Which Workflow Pack powers this deal room. Demo properties are always
  // CRE Acquisition; custom rooms carry their pack id from creation time.
  // Resolution (deal_type inference wins over the stored workflow_pack_id
  // column) lives in one shared place — lib/workflowPacks.resolvePackId —
  // so every page that needs a room's pack (this page, checkout success,
  // invite links, etc.) agrees, instead of duplicating/drifting logic.
  const packId = demoProperty ? DEFAULT_PACK_ID : resolvePackId(apiProperty);
  const pack = getWorkflowPack(packId);
  const isCREPack       = packId === DEFAULT_PACK_ID;
  const isTokenization  = isDigitalAssetLayerEnabled(apiProperty, pack);
  const isTokenizationRelevant = TOKENIZATION_RELEVANT_TYPES.has(apiProperty?.deal_type)
    || pack?.id === 'tokenization'
    || pack?.transactionType === 'tokenization';

  // This hook must run on the PIN-gate render and the unlocked render alike.
  // Calling it below the gate's early return triggers React error #310
  // ("Rendered more hooks than during the previous render").
  usePageTitle(property?.name || property?.property_name);

  if (inviteToken && !participantSession) {
    return (
      <DealRoomPinGate
        propertyId={propertyId}
        role={requestedRole}
        inviteToken={inviteToken}
        onUnlocked={handleParticipantUnlocked}
      />
    );
  }

  // Role metadata (label/icon/color/headline/subtext/sections) is looked up
  // scoped to this pack — never from a flat cross-pack dict — since a role
  // key like "lender" can mean something different in another pack.
  // Fallback: if the role isn't in this pack (e.g. old bundle, typo, new role
  // not yet deployed), show a neutral "invited" message rather than the primary
  // owner's private "full view of all parties" copy.
  const _genericFallback = {
    key: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
    icon: "👤",
    color: pack.roles[0]?.color || "#800020",
    needsDocs: false,
    headline: "Review the shared documents and transaction materials",
    subtext: "You can review the documents and status shared in this deal room.",
    sections: [],
    invitable: true,
  };
  const baseRoleConfig = pack.getRole(role) || _genericFallback;
  const isHotel = (property?.property_type || "").toLowerCase().includes("hotel") ||
                  (property?.property_type || "").toLowerCase().includes("hospitality");
  const roleConfig = isHotel && ['owner', 'broker', 'borrower'].includes(role)
    ? { ...baseRoleConfig, sections: ['brand-standards', ...(baseRoleConfig.sections || [])] }
    : baseRoleConfig;

  // Ownership/session semantics are authoritative. Role metadata is only a
  // fallback for legacy owner links and packs whose primary role is explicitly
  // non-invitable; a canManage flag alone must not turn an external participant
  // into the workspace owner.
  const isOwnerAccess = property?.access?.mode === 'owner';
  const isCoordinator = isOwnerAccess
    || (hasOwnerToken && role === 'owner')
    || (
      property?.access?.mode !== 'participant'
      && hasOwnerToken
      && roleConfig?.canManage === true
      && roleConfig?.invitable !== true
    );

  // The "Outstanding Items" grid (risk/compliance/property panels) still
  // hardcodes CRE concepts (NOI, DSCR, occupancy) inside the panels
  // themselves, but *which* panels a pack supports is now pack-driven:
  // roleConfig.sections says which sections a role wants to see, the pack's
  // `outstandingItemsSections` says which ones it actually has. Business
  // Acquisition declares none, so the grid is naturally empty for it.
  const visibleOutstandingSections = (roleConfig.sections || []).filter(
    (s) => pack.outstandingItemsSections?.includes(s)
  );

  // Task #187 — prevent participants from seeing room content before their session
  // is confirmed on slow connections. When an invite token is present the page
  // must NOT flash any room content while the API is still loading; show a
  // dedicated "confirming access" spinner instead of the generic workspace spinner.
  if (inviteToken && loadingApi) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-xs">
            <div className="w-10 h-10 border-2 border-gray-200 border-t-[#800020] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-700">Confirming your access…</p>
            <p className="text-xs text-gray-400 mt-1">Please wait while we verify your invitation.</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Generic loading state
  if (loadingApi && isCustom) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-red-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading deal room…</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (packLoadError && isCustom) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Deal room configuration unavailable</h1>
            <p className="text-sm text-gray-600">
              This deal room could not load its transaction-specific configuration, so Kontra stopped instead of showing the wrong template.
            </p>
            <p className="mt-3 text-xs text-red-700 break-words">{packLoadError}</p>
            <button onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 rounded-xl bg-[#800020] text-white text-sm font-semibold">
              Try again
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Shouldn't hit this since we fall back to derived name, but just in case
  if (!property) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Deal room not found</h1>
          <p className="text-gray-500 text-sm mb-6">This link may have expired or the property ID is incorrect.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#800020" }}>Back to Kontra</Link>
        </div>
      </PublicLayout>
    );
  }

  const SECTION_MAP = property.isCustom
    ? buildPendingSectionMap(property, role, onAnalysisSaved, propertyId, analysesRefreshKey, pack)
    : {
        financials: () => <FinancialsPanel property={property} />,
        risk:       () => <RiskPanel property={property} />,
        compliance: () => <CompliancePanel property={property} />,
        inspection: () => <InspectionPanel property={property} />,
        insurance:  () => <InsurancePanel property={property} />,
        readiness:  () => <ReadinessPanel property={property} />,
        documents:  () => <DocumentsPanel />,
        property:   () => <PropertyPanel property={property} />,
      };

  const pid = propertyId || property.property_id || property.id;

  return (
    <>
    {/* ── Demo intro overlay ───────────────────────────────────────────── */}
    {showDemoIntro && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 backdrop-blur-sm px-6">
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6"
            style={{ background: "#80002015", border: "1px solid #80002040" }}>
            {propertyId === 'kontra-demo-biz' ? '💼' : propertyId === 'kontra-demo-fundraising' ? '📈' : '🏢'}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#c0392b" }}>
            Welcome to the Kontra Demo
          </p>
          <h2 className="text-2xl font-black text-white mb-4 leading-snug">
            You're about to enter a live deal room.
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            One deal room coordinates every participant, stage, and deadline — from kickoff to close.
          </p>
          <ul className="text-left space-y-3 mb-8">
            {[
              "Coordinates all participants from one deal room",
              "AI reviews every document and surfaces flags",
              "Tracks what's missing and who needs to act",
              "Prepares a clear package for external review",
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              sessionStorage.setItem('kontra-demo-intro-seen', '1');
              setShowDemoIntro(false);
            }}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Enter Demo →
          </button>
          <p className="text-xs text-gray-600 mt-3">No account required</p>
        </div>
      </div>
    )}
    <PublicLayout
      hideFooter
      dealRoomMode={!!(property.isCustom && !isDemo)}
      dealRoomTitle={property.name || property.property_name || ""}
    >
      {/* Pack correction banner — shown to coordinators when AI detects a wrong workflow pack */}
      {packSuggestion && isCoordinator && !isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-lg shrink-0">🔍</span>
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  This looks like a {PACK_LABELS[packSuggestion.suggestedPack] || packSuggestion.suggestedPack} deal room
                </p>
                <p className="text-[10px] text-amber-700">
                  Currently using {PACK_LABELS[packSuggestion.currentPack] || packSuggestion.currentPack} template — switching loads the right document checklist, roles, and stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRepack(packSuggestion.suggestedPack)}
                disabled={repackLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#d97706' }}>
                {repackLoading ? 'Switching…' : `Switch to ${PACK_LABELS[packSuggestion.suggestedPack]} →`}
              </button>
              <button
                onClick={() => setPackSuggestion(null)}
                className="text-xs text-amber-600 hover:text-amber-900 transition px-2">
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar — demo banner | owner bar | invite bar */}
      {isDemo ? (
        <div className="border-b px-6 py-3" style={{ background: "linear-gradient(90deg, #4a0010 0%, #800020 100%)", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                LIVE DEMO
              </span>
              <div>
                <p className="text-xs font-semibold text-white">{property?.name || property?.property_name || 'Kontra Demo'} · AI features active</p>
                <p className="text-[10px] text-white/50">Shared demo room · Explore all panels · No signup required</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
              Create Your Deal Room →
            </Link>
          </div>
        </div>
      ) : property.isCustom && isCoordinator ? (
        <div className="border-b border-green-100 bg-green-50 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0 bg-green-100">
                🔑
              </div>
              <div>
                <p className="text-xs font-semibold text-green-900">Deal room active — invite participants and upload documents to begin</p>
                <p className="text-[10px] text-green-600">Secure role-based access for every participant · AI analyzes each file as it's uploaded</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShareButton propertyId={propertyId} />
            </div>
          </div>
        </div>
      ) : property.isCustom ? (
        <div className="border-b px-6 py-3" style={{ borderColor: roleConfig.color + '20', background: roleConfig.color + '06' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: roleConfig.color + '15' }}>
                {roleConfig.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  {from ? `${decodeURIComponent(from)} invited you` : "You've been invited"} · <span style={{ color: roleConfig.color }}>{roleConfig.label}</span>
                </p>
                <p className="text-[10px] text-gray-400">Review the documents assigned to your role below · Access via secure invitation link</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-gray-500">
              Role-scoped access
            </span>
          </div>
        </div>
      ) : (
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: roleConfig.color + "12" }}>
                {roleConfig.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  {from ? `${decodeURIComponent(from)} invited you` : "You've been invited"} · <span style={{ color: roleConfig.color }}>{roleConfig.label} view</span>
                </p>
                <p className="text-[10px] text-gray-400">Role-scoped deal room · Demo mode</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-gray-500">
              Role-scoped access
            </span>
          </div>
        </div>
      )}

      {/* Workspace tab nav — coordinator view of live paid rooms only */}
      {property.isCustom && !isDemo && (
        <WorkspaceTabNav
          activeTab={activeTab}
          onChange={setActiveTab}
          isCoordinator={isCoordinator}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">

        {property.isCustom && !isDemo ? (

          /* ── Shared workspace layout ───────────────────────────────────── */
          <>
            {/* Floating AI button — persists across all coordinator tabs */}
            {isCoordinator && <RoomCopilot propertyId={pid} />}

            {activeTab === 'overview' && (
              isCoordinator ? (
                <CoordinatorOverview
                    propertyId={pid}
                    property={property}
                    pack={pack}
                    packId={packId}
                    onTabChange={setActiveTab}
                    refreshKey={analysesRefreshKey}
                  />
              ) : (
                <ParticipantOverview
                  propertyId={pid}
                  property={property}
                  pack={pack}
                  role={role}
                  roleConfig={roleConfig}
                  onTabChange={setActiveTab}
                  refreshKey={analysesRefreshKey}
                />
              )
            )}

            {activeTab === 'documents' && (
              <>
                <div id="documents-panel">
                  <DocumentsTabPanel
                    propertyId={pid}
                    propertyType={property.property_type || property.type}
                    role={role}
                    isDemo={false}
                    packId={packId}
                    packReady={packReady}
                    onAnalysisSaved={onAnalysisSaved}
                    refreshKey={analysesRefreshKey}
                    onPeople={() => setActiveTab('people')}
                  />
                </div>
              </>
            )}

            {activeTab === 'people' && isCoordinator && (
              <ParticipantsPanel
                roomId={pid}
                packId={packId}
                isV2={!!property.auth_v2_enabled}
                isCoordinator={isCoordinator}
                coordinatorRole={isCoordinator ? (
                  pack.roles?.find(r => r.canManage === true) || {
                    key: 'deal_coordinator',
                    icon: '🏢',
                    label: 'Deal Owner',
                    color: '#800020',
                  }
                ) : null}
              />
            )}

            {activeTab === 'people' && !isCoordinator && (
              <ParticipantPeoplePanel pack={pack} role={role} roleConfig={roleConfig} />
            )}

            {activeTab === 'settings' && isCoordinator && (
              <div className="space-y-4">
                <TransactionDetailsPanel propertyId={pid} property={property} pack={pack} />
              </div>
            )}
          </>

        ) : (

          /* ── Non-coordinator / demo / participant stacked layout ─────── */
          <>
            {/* Property header */}
            <div className="relative rounded-2xl overflow-hidden mb-6 h-40">
              <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-end p-5">
                <div className="flex-1">
                  <p className="text-xs text-white/60 mb-0.5">
                    {isCREPack
                      ? [property.type, property.market].filter(Boolean).join(" · ")
                      : [pack.name, property.market || property.address].filter(Boolean).join(" · ")}
                    {property.isCustom && !isDemo && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 text-[10px] font-semibold">Awaiting Documents</span>}
                    {isDemo && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(99,102,241,0.4)", color: "#c7d2fe" }}>Under Review</span>}
                  </p>
                  <h1 className="text-xl font-bold text-white">{property.name}</h1>
                  <p className="text-xs text-white/70">{property.address}</p>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-white mb-1" style={{ background: roleConfig.color }}>
                    {roleConfig.icon} {roleConfig.label}
                  </div>
                  {!property.isCustom && (
                    <div className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: property.riskColor + "22", color: property.riskColor }}>
                      {property.risk} Risk · {property.score}/100
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Investment Readiness summary bar — demo rooms only */}
            {!property.isCustom && (
              <ReadinessSummaryBar property={property} />
            )}

            {/* Role context card */}
            {!isCoordinator && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
                style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
                <h2 className="text-base font-bold text-gray-900 mb-1">{roleConfig.headline}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{roleConfig.subtext}</p>
              </div>
            )}

            {/* #180 — Tokenization: role-specific action items for participants */}
            {false && property.isCustom && isTokenization && !isCoordinator && (() => {
              const DONE_SET = new Set(['uploaded', 'approved', 'ai_complete']);
              const myDocs = (docSchema || []).filter(d =>
                Array.isArray(d.assignedTo) && d.assignedTo.includes(role) && d.required
              );
              if (myDocs.length === 0) return null;
              const myItems = myDocs.map(d => {
                const item = checklistItems.find(i => i.section === d.section || i.id === d.id);
                return { ...d, done: item ? DONE_SET.has(item.status) : false };
              });
              const pending = myItems.filter(i => !i.done);
              const done    = myItems.filter(i => i.done);
              const allDone = pending.length === 0 && done.length > 0;
              const accentColor = allDone ? '#16a34a' : '#d97706';
              return (
                <div className="rounded-2xl border p-5 mb-6"
                  style={{
                    borderLeftWidth: 4, borderLeftColor: accentColor,
                    background: allDone ? '#f0fdf4' : '#fffbeb',
                    borderColor: allDone ? '#bbf7d0' : '#fde68a',
                  }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: allDone ? '#15803d' : '#92400e' }}>
                    {allDone ? '✓ Your action items — all complete' : 'Your action items'}
                  </p>
                  <div className="space-y-2.5">
                    {pending.map((doc, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-amber-500 text-sm shrink-0 mt-0.5">○</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                          {doc.jurisdictionNote && (
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{doc.jurisdictionNote}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {done.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2.5 opacity-50">
                        <span className="text-green-600 text-sm shrink-0">✓</span>
                        <p className="text-sm text-gray-600 line-through">{doc.label}</p>
                      </div>
                    ))}
                  </div>
                  {pending.length > 0 && (
                    <button
                      onClick={() => onTabChange?.('documents')}
                      className="mt-3 text-[11px] font-bold hover:opacity-80 transition"
                      style={{ color: '#92400e' }}>
                      Go to Documents → upload your files
                    </button>
                  )}
                </div>
              );
            })()}

            {/* AI Briefing Panel */}
            {property.isCustom && (
              <AIBriefingPanel propertyId={pid} ownerName={property.first_name} dealName={property.name || property.property_name} />
            )}

            {/* Activity Timeline */}
            {property.isCustom && (
              <div className="mb-6">
                <ActivityTimeline propertyId={pid} />
              </div>
            )}

            {/* Tasks / Today's Actions */}
            {property.isCustom && (
              <div id="tasks-panel">
                <TasksPanel propertyId={pid} role={role} onTabChange={setActiveTab} authHeaders={getRoomAuthHeaders(pid)} />
              </div>
            )}

            {/* Setup checklist — shown only to the managing/primary role */}
            {property.isCustom && isCoordinator && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
                style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
                <h2 className="text-base font-bold text-gray-900 mb-3">Setup Checklist</h2>
                {!isDemo ? (
                  <OnboardingProgress
                    propertyId={pid}
                    accentColor={roleConfig.color}
                    totalInvitable={(pack.roles || []).filter(r => r.invitable).length}
                    pack={pack}
                  />
                ) : (
                  <ol className="space-y-2.5">
                    {[
                      `Invite parties — send role-specific links to ${(pack.roles || []).filter(r => r.invitable).slice(0, 3).map(r => r.label).join(", ") || "every stakeholder"}`,
                      "Upload documents — AI reviews each file as it arrives and surfaces key findings",
                      "Track approvals — monitor transaction stage, party status, and action items in real time",
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                          style={{ background: roleConfig.color }}>{i + 1}</span>
                        {text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* Documents panel */}
            {property.isCustom && (
              <div id="documents-panel">
                <DocumentsTabPanel
                  propertyId={pid}
                  propertyType={property.property_type || property.type}
                  role={role}
                  isDemo={isDemo}
                  packId={packId}
                  packReady={packReady}
                  onAnalysisSaved={onAnalysisSaved}
                  refreshKey={analysesRefreshKey}
                  jurisdiction={isTokenization ? (property.jurisdiction || "") : ""}
                />
              </div>
            )}

            {/* Legal Intelligence */}
            {property.isCustom && (isCoordinator || role === 'attorney' || role === 'counsel') && (
              <LegalReviewPanel propertyId={pid} pack={pack} isDemo={isDemo} />
            )}

            {/* Transaction Risk — coordinator only */}
            {property.isCustom && isCoordinator && (
              <TransactionRiskPanel propertyId={pid} />
            )}

            {/* Deal Coordination Panel */}
            {property.isCustom && (
              <DealCoordinationPanel
                propertyId={pid}
                role={role}
                packId={packId}
                propertyType={property.property_type || property.type}
              />
            )}

            {/* Notification log */}
            {property.isCustom && !isDemo && isCoordinator && (
              <NotificationsLog propertyId={pid} />
            )}

            {/* Outstanding Items */}
            {visibleOutstandingSections.length > 0 && (
              <div className="grid md:grid-cols-2 gap-5 mb-6">
                {visibleOutstandingSections.map((sectionKey) => {
                  const Panel = SECTION_MAP[sectionKey];
                  return Panel ? <Panel key={sectionKey} /> : null;
                })}
              </div>
            )}

            {/* Activity feed — demo rooms only */}
            {!property.isCustom && (
              <div className="mb-8">
                <ActivityFeedPanel property={property} />
              </div>
            )}

            {/* Activate CTA (only for demo rooms) */}
            {!property.isCustom && (
              <div className="rounded-2xl overflow-hidden border border-gray-200">
                <div className="px-8 py-8 text-center"
                  style={{ background: `linear-gradient(135deg, ${roleConfig.color} 0%, ${roleConfig.color}dd 100%)` }}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">One-time deal fee</p>
                  <div className="text-4xl font-black text-white mb-1">$499</div>
                  <p className="text-sm text-white/80 mb-5">Activates the full deal room for all parties on this property</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto mb-6">
                    {["All-party deal room", "AI document analysis", "Role-scoped access", "Compliance tracking"].map((f) => (
                      <div key={f} className="bg-white/10 rounded-xl px-3 py-2 text-xs text-white/90 font-medium">{f}</div>
                    ))}
                  </div>
                  <button onClick={handleActivate} disabled={checkoutLoading}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-white transition hover:opacity-90 disabled:opacity-60"
                    style={{ color: roleConfig.color }}>
                    {checkoutLoading ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Preparing…</>
                    ) : "Activate Deal Room — $499 →"}
                  </button>
                  {import.meta.env.DEV && (
                    <button onClick={handleDemoActivate} disabled={checkoutLoading}
                      className="mt-3 inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition disabled:opacity-40">
                      ⚡ Dev: Skip Payment
                    </button>
                  )}
                  {checkoutError && <p className="text-xs text-red-200 mt-3">{checkoutError}</p>}
                  <p className="text-xs text-white/40 mt-3">Secure checkout via Stripe · One-time fee</p>
                </div>
                <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Are you the owner of this deal room?</p>
                    <p className="text-xs text-gray-400">Access your dashboard to manage this room</p>
                  </div>
                  <Link to="/my-deal-rooms"
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: roleConfig.color }}>
                    My Deal Rooms →
                  </Link>
                </div>
              </div>
            )}

            {/* Demo bottom CTA */}
            {isDemo && (
              <div className="rounded-2xl overflow-hidden border border-indigo-100 mt-2">
                <div className="px-8 py-8 text-center" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                    You just experienced Kontra
                  </p>
                  <h2 className="text-2xl font-extrabold text-white mb-2">
                    Ready to coordinate your deal to closing?
                  </h2>
                  <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                    Set up a deal room for your property in under 2 minutes. AI analyzes every document as it's uploaded. Every party gets their own view.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link to="/create-deal-room"
                      className="px-8 py-3 rounded-xl text-sm font-bold bg-white text-indigo-900 hover:opacity-90 transition">
                      Create Your Deal Room — $499 →
                    </Link>
                    <Link to="/pricing"
                      className="px-6 py-3 rounded-xl text-sm font-semibold border border-white/20 text-white/80 hover:bg-white/10 transition">
                      See Pricing
                    </Link>
                  </div>
                  <p className="text-[10px] text-white/30 mt-4">One-time fee · No subscription · 90-day access included</p>
                </div>
                <div className="bg-gray-50 px-8 py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-100">
                  {["2 min setup", "18 sec AI review", "Unlimited participants", "Unlimited documents"].map(f => (
                    <span key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="text-green-500">✓</span> {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </PublicLayout>
    </>
  );
}

