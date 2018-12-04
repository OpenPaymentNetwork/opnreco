
import React from 'react';
import { FormattedDate } from 'react-intl';


export function renderReportDate(file, now) {
  if (file.end_date && file.start_date) {
    if (file.end_date !== file.start_date) {
      return (
        <span>
          <span title={file.start_date}>
            <FormattedDate value={file.start_date}
              day="numeric" month="short" year="numeric" timeZone="UTC" />
          </span>
          {' to '}
          <span title={file.end_date}>
            <FormattedDate value={file.end_date}
              day="numeric" month="short" year="numeric" timeZone="UTC" />
          </span>
        </span>);
    } else {
      return (
        <span title={file.end_date}>
          <FormattedDate value={file.end_date}
            day="numeric" month="short" year="numeric" timeZone="UTC" />
        </span>);
    }
  } else if (file.start_date) {
    return (
      <span>
        <span title={file.start_date}>
          <FormattedDate value={file.start_date}
            day="numeric" month="short" year="numeric" timeZone="UTC" />
        </span>
        {' to '}
        <span title={now}>
          <FormattedDate value={now}
            day="numeric" month="short" year="numeric" /> (in progress)
        </span>
      </span>);
  } else {
    return <span>Initial</span>;
  }
}


export function renderReportDateString(file, now, intl) {
  const dateOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  };
  if (file.end_date && file.start_date) {
    if (file.end_date !== file.start_date) {
      const startStr = intl.formatDate(file.start_date, dateOptions);
      const endStr = intl.formatDate(file.end_date, dateOptions);
      return `${startStr} to ${endStr}`;
    } else {
      return `${intl.formatDate(file.end_date, dateOptions)}`;
    }
  } else if (file.start_date) {
      const startStr = intl.formatDate(file.start_date, dateOptions);
      const endStr = intl.formatDate(
        now, {...dateOptions, timeZone: undefined});
      return `${startStr} to ${endStr}`;
  } else {
    return 'Initial';
  }
}
