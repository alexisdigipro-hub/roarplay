// A Mac app has to carry at least an ad-hoc signature or an Apple Silicon Mac calls it "damaged".
// There is no paid Apple certificate (Alex, 15 Oct: a few people of his own), so the app is signed
// ad hoc after packing; the first open then needs Open Anyway once, nothing more.
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  // the helper and ffmpeg in Resources/bin are not where --deep looks, so they are signed first, by name
  const fs = require('fs')
  for (const f of ['BlackmagicRawAPI.framework', 'roarplay-braw', 'setdefault', 'ffmpeg']) {
    const p = path.join(app, 'Contents', 'Resources', 'bin', f)
    if (fs.existsSync(p)) execFileSync('codesign', ['--force', ...(f.endsWith('.framework') ? ['--deep'] : []), '--sign', '-', p], { stdio: 'inherit' })
  }
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
}
