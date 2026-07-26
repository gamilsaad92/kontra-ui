/**
 * DealRoomPinGate — placeholder skeleton.
 *
 * The per-invitation access system (Task #72) has been built at the database
 * layer. This component will be replaced in Task #73 with a full gate that:
 *   • Reads the invite token from the URL
 *   • Calls get_invite_status() to determine verification method
 *   • Shows email-OTP or PIN entry form
 *   • Receives a server-issued session token on success
 *   • Passes that token as x-kontra-session on all subsequent Supabase queries
 *
 * Until Task #73 ships, this skeleton always blocks participant access, which
 * is consistent with the RLS policies now in place — there is no way to reach
 * deal room data without a valid session token from verify_invite_credential()
 * or create_invite_session_for_email().
 */
export default function DealRoomPinGate({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#800020] flex items-center justify-center">
              <span className="text-white text-sm font-bold select-none">K</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Kontra</span>
          </div>
          <p className="text-[11px] text-gray-400">Secure Deal Room</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-2">Invitation Required</h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-5 max-w-[220px] mx-auto">
            This deal room requires a personal invitation link. Contact the deal owner to receive access.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-amber-700">Access is by invitation only</p>
            <p className="text-[10px] text-amber-500 mt-0.5">Each participant receives a unique, secure link</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-5">
          Powered by Kontra · Confidential deal room
        </p>
      </div>
    </div>
  );
}
