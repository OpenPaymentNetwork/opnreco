
/** Return true if the event is a simple click event. */
export function isSimpleClick(event) {
  return (event.button === 0 && !event.ctrlKey && !event.shiftKey &&
      !event.altKey && !event.metaKey);
}
