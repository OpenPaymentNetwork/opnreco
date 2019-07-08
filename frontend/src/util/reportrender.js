
import React from 'react';
import { FormattedDate } from 'react-intl';


export function renderReportDate(period, now) {
  if (period.end_date && period.start_date) {
    if (period.end_date !== period.start_date) {
      return (
        <span>
          <span title={period.start_date}>
            <FormattedDate value={period.start_date}
              day="numeric" month="short" year="numeric" timeZone="UTC" />
          </span>
          {' to '}
          <span title={period.end_date}>
            <FormattedDate value={period.end_date}
              day="numeric" month="short" year="numeric" timeZone="UTC" />
          </span>
        </span>);
    } else {
      return (
        <span title={period.end_date}>
          <FormattedDate value={period.end_date}
            day="numeric" month="short" year="numeric" timeZone="UTC" />
        </span>);
    }
  } else if (period.start_date) {
    return (
      <span>
        <span title={period.start_date}>
          <FormattedDate value={period.start_date}
            day="numeric" month="short" year="numeric" timeZone="UTC" />
        </span>
        {' to '}
        <span title={now}>
          <FormattedDate value={now}
            day="numeric" month="short" year="numeric" /> (in progress)
        </span>
      </span>);
  } else {
    return <span>Initial Period</span>;
  }
}


export function renderReportHead(file, reportTitle, reportDate) {
  return (
    <React.Fragment>
      {reportTitle} - {file.owner_title}
      <div>
        {file.title} ({file.currency}) - {reportDate}
      </div>
    </React.Fragment>
  );
}


export function renderPeriodDateString(period, intl) {
  const dateOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  };
  if (period.end_date && period.start_date) {
    if (period.end_date !== period.start_date) {
      const startStr = intl.formatDate(period.start_date, dateOptions);
      const endStr = intl.formatDate(period.end_date, dateOptions);
      return `${startStr} to ${endStr}`;
    } else {
      return `${intl.formatDate(period.end_date, dateOptions)}`;
    }
  } else if (period.start_date) {
    const startStr = intl.formatDate(period.start_date, dateOptions);
    return `${startStr} (in progress)`;
  } else {
    return 'Initial Period';
  }
}
