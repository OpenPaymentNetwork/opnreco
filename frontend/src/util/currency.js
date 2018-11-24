
import React from 'react';

// Most currencies use 2 subunit digits. These are the exceptions.
const currencySubunitDigits = {
  'BHD': 3,
  'BYR': 0,
  'CLP': 0,
  'CVE': 0,
  'DJF': 0,
  'GNF': 0,
  'HUF': 0,
  'IDR': 0,
  'IQD': 3,
  'IRR': 0,
  'ISK': 0,
  'JOD': 3,
  'JPY': 0,
  'KHR': 0,
  'KMF': 0,
  'KRW': 0,
  'KWD': 3,
  'LBP': 0,
  'LYD': 3,
  'MGA': 0,
  'MRO': 0,
  'OMR': 3,
  'PYG': 0,
  'RWF': 0,
  'TND': 3,
  'UGX': 0,
  'VND': 0,
  'VUV': 0,
  'XAF': 0,
  'XOF': 0,
  'XPF': 0,
};


// Note: Don't use the currency feature of NumberFormat. It formats poorly.
const numFmts = {
  0: new Intl.NumberFormat('en-US', {'minimumFractionDigits': 0}),
  2: new Intl.NumberFormat('en-US', {'minimumFractionDigits': 2}),
  3: new Intl.NumberFormat('en-US', {'minimumFractionDigits': 3}),
};


export function getCurrencyFormatter(currency) {
  // Show parens for negative.
  const digits0 = currencySubunitDigits[currency];
  const digits1 = (digits0 === undefined ? 2 : digits0);
  const numFmt = numFmts[digits1];
  return value => {
    if (typeof value === 'string' && value.startsWith('-')) {
      return `(${numFmt.format(value.substr(1))})`;
    } else if (value < 0) {
      return `(${numFmt.format(-value)})`;
    }
    return numFmt.format(value);
  };
}


export function getCurrencyDeltaFormatter(currency) {
  // Show + or - for every value except 0. Use the 'minus' entity (\u2212)
  // to keep alignment with plus signs.
  const digits0 = currencySubunitDigits[currency];
  const digits1 = (digits0 === undefined ? 2 : digits0);
  const numFmt = numFmts[digits1];
  return value => {
    if (typeof value === 'string') {
      if (value.startsWith('-')) {
        return <span>&minus;{numFmt.format(value.substr(1))}</span>;
      } else if (/^0+(\.0*)?$/.test(value)) {
        return '0';
      }
    } else if (value === 0) {
      return '0';
    } else if (value < 0) {
      return <span>&minus;{numFmt.format(-value)}</span>;
    }
    return `+${numFmt.format(value)}`;
  };
}
