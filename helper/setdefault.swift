// RoarPlay's helper on a Mac: make RoarPlay the app that opens the given file kinds (Alex, 31 Oct: "choose which files
// open straight in RoarPlay"). The Mac asks the person to confirm each kind it is asked for, so this helper asks for as
// little as it can: kinds already set to RoarPlay are skipped, and `--broad` asks for the general kinds first
// (public.movie, public.audio), which cover most files in two questions.
//   setdefault <bundle id> --status <ext>...   prints ext=<bundle id of the app that opens it now> (or ext=none)
//   setdefault <bundle id> --broad             sets the general kinds; prints kind=ok|same|<code>
//   setdefault <bundle id> <ext>...            sets each kind; prints ext=ok|same|notype|<code>
import Foundation
import CoreServices
import UniformTypeIdentifiers

let args = CommandLine.arguments
if args.count < 3 { print("usage: setdefault <bundle id> [--status|--broad] <ext>..."); exit(2) }
let bundle = args[1]
let mode = args[2].hasPrefix("--") ? args[2] : ""
let exts = Array(args[(mode.isEmpty ? 2 : 3)...])

func types(for ext: String) -> [String] {
  var ids: [String] = []
  if #available(macOS 11.0, *) {
    if let t = UTType(filenameExtension: ext) { ids.append(t.identifier) }
    if let t = UTType(filenameExtension: ext, conformingTo: .movie) { ids.append(t.identifier) }
    if let t = UTType(filenameExtension: ext, conformingTo: .audio) { ids.append(t.identifier) }
  }
  return Array(Set(ids))
}
func current(_ id: String) -> String {
  if let h = LSCopyDefaultRoleHandlerForContentType(id as CFString, .all)?.takeRetainedValue() { return h as String }
  return "none"
}
func set(_ id: String) -> String {
  if current(id).lowercased() == bundle.lowercased() { return "same" }
  let st = LSSetDefaultRoleHandlerForContentType(id as CFString, .all, bundle as CFString)
  return st == 0 ? "ok" : String(st)
}

if mode == "--status" {
  for ext in exts { let ids = types(for: ext); print("\(ext)=\(ids.isEmpty ? "notype" : current(ids[0]))") }
} else if mode == "--broad" {
  for id in ["public.movie", "public.video", "public.audio", "public.audiovisual-content"] { print("\(id)=\(set(id))") }
} else {
  for ext in exts {
    let ids = types(for: ext)
    if ids.isEmpty { print("\(ext)=notype"); continue }
    var worst = "ok"; var all = true
    for id in ids { let r = set(id); if r != "ok" && r != "same" { worst = r }; if r != "same" { all = false } }
    print("\(ext)=\(worst != "ok" ? worst : (all ? "same" : "ok"))")
  }
}
