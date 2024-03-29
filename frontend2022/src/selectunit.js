// Copied (with type annotations stripped) from
// https://github.com/formatjs/formatjs/blob/%40formatjs/intl-utils%403.3.1/packages/intl-utils/src/diff.ts

const MS_PER_SECOND = 1e3;
const SECS_PER_MIN = 60;
const SECS_PER_HOUR = SECS_PER_MIN * 60;
const SECS_PER_DAY = SECS_PER_HOUR * 24;
const SECS_PER_WEEK = SECS_PER_DAY * 7;

export function selectUnit(
    from,
    to = Date.now(),
    thresholds = {}
) {
    const resolvedThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...(thresholds || {}),
    };
    const secs = (+from - +to) / MS_PER_SECOND;
    if (Math.abs(secs) < resolvedThresholds.second) {
        return {
            value: Math.round(secs),
            unit: 'second',
        };
    }
    const mins = secs / SECS_PER_MIN;
    if (Math.abs(mins) < resolvedThresholds.minute) {
        return {
            value: Math.round(mins),
            unit: 'minute',
        };
    }
    const hours = secs / SECS_PER_HOUR;
    if (Math.abs(hours) < resolvedThresholds.hour) {
        return {
            value: Math.round(hours),
            unit: 'hour',
        };
    }

    const days = secs / SECS_PER_DAY;
    if (Math.abs(days) < resolvedThresholds.day) {
        return {
            value: Math.round(days),
            unit: 'day',
        };
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const years = fromDate.getFullYear() - toDate.getFullYear();
    if (Math.round(Math.abs(years)) > 0) {
        return {
            value: Math.round(years),
            unit: 'year',
        };
    }

    const months = years * 12 + fromDate.getMonth() - toDate.getMonth();
    if (Math.round(Math.abs(months)) > 0) {
        return {
            value: Math.round(months),
            unit: 'month',
        };
    }
    const weeks = secs / SECS_PER_WEEK;

    return {
        value: Math.round(weeks),
        unit: 'week',
    };
}

export const DEFAULT_THRESHOLDS = {
    second: 45, // seconds to minute
    minute: 45, // minutes to hour
    hour: 22, // hour to day
    day: 5, // day to week
};
