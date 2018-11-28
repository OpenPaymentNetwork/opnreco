
export const wfTypeTitles = {
  // _account_credit: '[Account Credit]', // Not a real transfer workflow type
  // _account_debit: '[Account Debit]', // Not a real transfer workflow type
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
  reclaim_notes: 'Reclaim Notes',  // BBB
  redeem: 'Deposit',
  return_to_provider: 'Return',
  roll_up: 'Roll Up',  // BBB
  send_design: 'Issue (Send Design)',
  settle: 'Settle',
  simple_grant: 'Grant',
};


/**
 * Return an identifier with dashes embedded for readability.
 * This matches the method OPN uses to expand transfer IDs.
 */
export function dashed(s) {
  let pos = 0;
  const parts = [];
  const sLen = s.length;
  while (pos < sLen) {
    parts.push(s.substr(pos, 4));
    pos += 4;
  }
  return parts.join('-');
}
