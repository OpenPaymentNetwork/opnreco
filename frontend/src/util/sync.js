

export function runSync(setSyncProgress) {
  var step = -2;

  function simProgress() {
    step += 1;
    if (step <= 10) {
      setSyncProgress(step * 10);
      window.setTimeout(simProgress, 1000);
    } else {
      setSyncProgress(null);
    }
  }

  simProgress();
}
