import React from 'react';

const wrap = (symbol) => (props) => <span {...props}>{symbol}</span>;

export const AlertTriangle = wrap('⚠️');
export const Bell = wrap('🔔');
export const CheckCircle2 = wrap('✅');
export const ChevronDown = wrap('▾');
export const Download = wrap('⬇️');
export const Filter = wrap('🔍');
export const Mail = wrap('✉️');
export const MoreHorizontal = wrap('⋯');
export const Plus = wrap('＋');
export const Search = wrap('🔎');
export const Settings = wrap('⚙️');
export const Sparkles = wrap('✨');
export const User = wrap('👤');
