export async function register() {
  if(process.env.NEXT_RUNTIME==='nodejs' && process.env.NODE_ENV==='production') {
    const { startReportAutomationWorker }=await import('./lib/report-builder/automation-worker');
    startReportAutomationWorker();
  }
}
