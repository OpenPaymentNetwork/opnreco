
/* A throttler is a function that delays calling a target function
   until a rest period has elapsed. For example, a throttler can
   improve a search bar by submitting queries only after the user
   stops typing for a moment.
*/

export function throttler(target, delay) {
  let triggerAfter = 0;
  let timeoutId = null;

  if (!delay) {
    delay = 0;
  }

  /* Postpone the trigger without calling it. */
  function postpone(interval) {
    const t = new Date().getTime() + interval;
    if (!triggerAfter || t > triggerAfter) {
      triggerAfter = t;
    }
  }

  function manage_timeout() {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    const now = new Date().getTime();
    if (now >= triggerAfter) {
      target();
    } else {
      timeoutId = window.setTimeout(manage_timeout, triggerAfter - now + 1);
    }
  }

  function throttler() {
    postpone(delay);
    manage_timeout();
  }

  throttler.trigger = function trigger() {
    // Don't delay any longer.
    triggerAfter = 0;
    manage_timeout();
  };

  throttler.waiting = function waiting() {
    return (timeoutId !== null);
  };

  throttler.postpone = postpone;
  return throttler;
}
