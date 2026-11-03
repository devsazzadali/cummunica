// F6: the demo users / chats / messages / statuses / calls /
// communities exports were deleted from this file — nothing
// rendered them, and keeping fake
// data in the shipped source violated the "no fake data pretending
// to be real" rule. Only what is actually imported remains:
// - DemoMsg: the message shape the (real) Composer still types.
// - initials(): used by the Avatar component in ui.tsx.
// - GIRLFRIEND_PRESETS / BOYFRIEND_DEFAULT: SAZMU setup presets
//   imported by /sazmu/setup (these are user-pickable call names,
//   not fake users or conversations).
export type DemoMsg={id:string;from:string;me:boolean;text:string;time:string;status?:"sent"|"delivered"|"read"};
export const GIRLFRIEND_PRESETS=["Sadia","Maria","Tithi","Borsha","Anika","Tajmira","Mim","Mimi","Mumu","Ayra","Jannati","Mushfika"];
export const BOYFRIEND_DEFAULT="Sazzad";
export function initials(name:string){return name.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase()}
