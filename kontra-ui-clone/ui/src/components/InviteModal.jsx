/**
 * InviteModal — legacy invite entry point from PropertyDetailPage.
 *
 * The global PIN system has been retired. This modal now generates the deal
 * room URL for each role and directs the owner to open the deal room's built-in
 * InvitePanel to issue secure, per-participant invite links with email OTP or PIN.
 *
 * No PIN generation or pinUtils imports. Uses inviteUtils for owner auth.
 */
import React, { useState } from "react";
import { requestOwnerOtp, verifyOwnerOtp, getOwnerSession, createInvite, generatePin } from "../lib/inviteUtils";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://kontraplatform.com";

export default function InviteModal({ property, onClose }) {
  const propertyId = property?.id || property?.property_id;
  const dealRoomUrl = `${BASE_URL}/deal-room/${propertyId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#800020] flex items-center justify-center">
              <span className="text-white text-xs font-bold select-none">K</span>
            </div>
            <h2 className="text-sm font-bold text-gray-900">Invite Participants</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* New invite system callout */}
          <div className="bg-[#800020]/5 border border-[#800020]/15 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-[#800020] mb-1">🔐 Secure per-participant invites</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Each participant now gets their own unique invite link — verified by email OTP or PIN
              before they can view the deal room. Open the deal room to create and manage invites.
            </p>
          </div>

          {/* Open deal room button */}
          <a
            href={`${dealRoomUrl}?role=owner`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
            style={{ background: "#800020" }}
          >
            <span>Open deal room → Invite tab</span>
            <span className="text-white/70 text-xs font-normal">kontraplatform.com</span>
          </a>

          {/* Deal room URL for quick reference */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Deal room link</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-500 flex-1 truncate font-mono">{dealRoomUrl}</p>
              <button
                onClick={() => navigator.clipboard.writeText(dealRoomUrl)}
                className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
              >
                Copy
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-1">
              Share this with participants — they'll need their personal invite link to enter.
            </p>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
