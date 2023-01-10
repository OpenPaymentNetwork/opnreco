
export const wfTypeTitles = {
  bill: 'Brand Cash Purchase',
  closed_profile_to_profile: 'Closed Profile to Profile',  // BBB
  cobrand_notes: 'Co-brand Pages',
  combine: 'Combine',
  customize_notes: 'Customize Pages',  // BBB
  expire: 'Expire Cash',
  fund: 'Fund',
  fxdeposit: 'Deposit Foreign Currency',
  issue_design: 'Issue (Send Design)',  // BBB
  link_bank_account: 'Link Account',  // BBB
  link_dfi_account: 'Link Account',
  non_payment: 'Non-Payment',
  personalize_notes: 'Personalize Pages',
  profile_to_profile: 'Profile to Profile',
  purchase_gift_card: 'Purchase Gift Card',
  purchase_offer: 'Purchase Offer',
  receive_ach: 'Receive via ACH',
  receive_ach_confirm: 'Receive ACH Confirmation',
  receive_ach_file: 'Receive ACH File',
  receive_ach_prenote: 'Receive ACH Prenote',
  receive_rtp_credit: 'Receive RTP Credit',
  receive_rtncore_credit: 'Receive Core Credit',
  reclaim_notes: 'Reclaim Notes',  // BBB
  redeem: 'Deposit',
  return_received_rtp_credit: 'Return Received RTP Credit',
  return_sent_rtp_credit: 'Return Sent RTP Credit',
  return_to_provider: 'Return',
  reversal: 'Reversal',
  roll_up: 'Roll Up',  // BBB
  send_design: 'Issue (Send Design)',
  send_rtp_credit: 'Send RTP Credit',
  send_rtncore_credit: 'Send Core Credit',
  settle: 'Settle',
  simple_grant: 'Grant',
  trade: 'Trade',
};


/**
 * Return an identifier with hyphens embedded for readability.
 * This matches the method OPN uses to expand transfer IDs.
 */
export function hyphenated(s) {
  let pos = 0;
  const parts = [];
  const sLen = s.length;
  while (pos < sLen) {
    parts.push(s.substr(pos, 4));
    pos += 4;
  }
  return parts.join('-');
}
