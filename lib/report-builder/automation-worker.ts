import 'server-only';
import { runDueAutomations } from './automation';

declare global {
  // eslint-disable-next-line no-var
  var __reportAutomationTimer: ReturnType<typeof setInterval> | undefined;
}
export function startReportAutomationWorker() {
  if(globalThis.__reportAutomationTimer) return;
  let running=false;
  let warned=false;
  const tick=async()=>{
    if(running) return;
    running=true;
    try { await runDueAutomations(); warned=false; }
    catch(error) {
      // Older deployments may start before the additive schema has been reapplied.
      if(!warned) console.warn('[report-automation] Worker unavailable; check migration and database connectivity.',(error as {code?:string}).code??'');
      warned=true;
    } finally {running=false;}
  };
  globalThis.__reportAutomationTimer=setInterval(()=>void tick(),60_000);
  globalThis.__reportAutomationTimer.unref?.();
}
