
import React from 'react';

export const allCurrencies = [
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYR',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GHS',
  'GIP',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HRK',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KPW',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MGA',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRO',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SHP',
  'SLL',
  'SOS',
  'SRD',
  'SSP',
  'STD',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'VEF',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XCD',
  'XOF',
  'XPF',
  'XTS',
  'YER',
  'ZAR',
  'ZMW',
];

const numFmt0 = new Intl.NumberFormat('en-US', { 'minimumFractionDigits': 0 });
const numFmt2 = new Intl.NumberFormat('en-US', { 'minimumFractionDigits': 2 });
const numFmt3 = new Intl.NumberFormat('en-US', { 'minimumFractionDigits': 3 });

// Most currencies use 2 subunit digits. These are the exceptions.
const numFmts = {
  'BHD': numFmt3,
  'BYR': numFmt0,
  'CLP': numFmt0,
  'CVE': numFmt0,
  'DJF': numFmt0,
  'GNF': numFmt0,
  'HUF': numFmt0,
  'IDR': numFmt0,
  'IQD': numFmt3,
  'IRR': numFmt0,
  'ISK': numFmt0,
  'JOD': numFmt3,
  'JPY': numFmt0,
  'KHR': numFmt0,
  'KMF': numFmt0,
  'KRW': numFmt0,
  'KWD': numFmt3,
  'LBP': numFmt0,
  'LYD': numFmt3,
  'MGA': numFmt0,
  'MRO': numFmt0,
  'OMR': numFmt3,
  'PYG': numFmt0,
  'RWF': numFmt0,
  'TND': numFmt3,
  'UGX': numFmt0,
  'VND': numFmt0,
  'VUV': numFmt0,
  'XAF': numFmt0,
  'XOF': numFmt0,
  'XPF': numFmt0,
};


// Note: Don't use the currency feature of NumberFormat. It formats poorly.


export function getCurrencyFormatter(currency) {
  // Show parens for negative.
  const numFmt = numFmts[currency] || numFmt2;
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
  const numFmt = numFmts[currency] || numFmt2;
  const res = value => {
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
  res.displayName = 'CurrencyDeltaFormatter';
  return res;
}
