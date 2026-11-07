import {appendFileSync,existsSync,readFileSync} from 'node:fs';
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary){
 const ipa=existsSync('native/artifacts/Lumen.json')?JSON.parse(readFileSync('native/artifacts/Lumen.json','utf8')):null;
 const smoke=existsSync('native/artifacts/simulator/native-smoke.json')?JSON.parse(readFileSync('native/artifacts/simulator/native-smoke.json','utf8')):null;
 appendFileSync(summary,`## Lumen offline iOS foundation\n\nSource: \`${process.env.GITHUB_SHA}\`\n\n`+
  (ipa?`- Device IPA: **compiled and validated**, ${ipa.architecture}, ${ipa.platform}. Download **Lumen-unsigned-IPA** under Artifacts.\n- SHA-256: \`${ipa.sha256}\`\n`:'- Device IPA unavailable: inspect the first failed build/validation step.\n')+
  (smoke?.passed?`- Simulator: **passed**. Checks: ${smoke.checks.join(', ')}.\n`:`- Simulator: **NOT verified**. ${smoke?.error||'Inspect smoke evidence and device.log; compilation does not establish runtime success.'}\n`)+
  '- Physical iPhone install/upgrade, keyboard/IME, share sheet and VoiceOver are separate owner checks.\n- Keep the same Apple Account and signed bundle identifier. Overwrite the installed app; do not uninstall or reset it.\n- Guide: native/README.md. No real auth/inference, merge or production deployment.\n');
}
