// RoarPlay's helper on a Mac: make RoarPlay the app that opens the given file kinds (Alex, 31 Oct: "choose which files
// open straight in RoarPlay"). Usage: setdefault <bundle id> <ext> <ext> ...  Each extension's type (UTI) is asked
// of the system, so MKV, MXF, BRAW and the rest work the same as MP4. Prints one line per extension: ext=ok or ext=<code>.
import Foundation
import CoreServices
import UniformTypeIdentifiers

let args = CommandLine.arguments
if args.count < 3 { print("usage: setdefault <bundle id> <ext>..."); exit(2) }
let bundle = args[1]
for ext in args[2...] {
  var ids: [String] = []
  if #available(macOS 11.0, *) {
    if let t = UTType(filenameExtension: ext) { ids.append(t.identifier) }
    if let t = UTType(filenameExtension: ext, conformingTo: .movie) { ids.append(t.identifier) }
    if let t = UTType(filenameExtension: ext, conformingTo: .audio) { ids.append(t.identifier) }
  }
  if ids.isEmpty { print("\(ext)=notype"); continue }
  var worst: OSStatus = 0
  for id in Set(ids) {
    let st = LSSetDefaultRoleHandlerForContentType(id as CFString, .all, bundle as CFString)
    if st != 0 { worst = st }
  }
  print("\(ext)=\(worst == 0 ? "ok" : String(worst))")
}
