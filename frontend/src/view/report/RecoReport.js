import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withStyles } from '@material-ui/core/styles';
import { getCurrencyFormatter } from '../../util/currency';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const styles = {
  root: {
    fontSize: '1.1rem',
  },
  tablePaper: {
    margin: '32px auto',
    maxWidth: 800,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  cell: {
    border: '1px solid #bbb',
  },
  headCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
  },
  amountCell: {
    textAlign: 'right',
    padding: '4px 8px',
  },
  miniAmountCell: {
    textAlign: 'right',
    padding: '4px 8px',
    fontSize: '80%',
  },
  labelCell: {
    padding: '4px 8px',
  },
  typeRow: {
  },
  clickableRow: {
    '&:hover': {
      backgroundColor: '#eee',
    },
    '& > td': {
      cursor: 'pointer',
    },
  },
  typeCell: {
    padding: '4px 8px 4px 32px',
  },
  typeAmountCell: {
    textAlign: 'right',
    padding: '4px 8px',
  },
  emptyTypeCell: {
    padding: '4px 8px 4px 32px',
    fontStyle: 'italic',
  },
  movementCell: {
    padding: '4px 8px 4px 64px',
    fontStyle: 'italic',
    fontSize: '80%',
  },
  arrow: {
    display: 'inline-block',
    transition: 'transform 100ms',
  },
  collapsedArrow: {
    transform: 'rotate(0deg)',
  },
  expandedArrow: {
    transform: 'rotate(90deg)',
  },
  hiddenArrow: {
    visibility: 'hidden',
  },
};


const wfTypeTitles = {
  bill: 'Brand Cash Purchase',
  closed_profile_to_profile: 'Closed Profile to Profile',  // BBB
  cobrand_notes: 'Co-brand Pages',
  combine: 'Combine',
  customize_notes: 'Customize Pages',  // BBB
  _exchange: '[Exchange]',
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


/** Return an identifier with dashes embedded for readability. */
function dashed(s) {
  let pos = 0;
  const parts = [];
  const sLen = s.length;
  while (pos < sLen) {
    parts.push(s.substr(pos, 4));
    pos += 4;
  }
  return parts.join('-');
}


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    recoReportURL: PropTypes.string,
    recoReport: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      expanded: {},  // 'sign|wfType': 1
    };
  }

  handleExpand(expandKey) {
    const {expanded} = this.state;
    this.setState({
      expanded: {
        ...expanded,
        [expandKey]: !expanded[expandKey],
      },
    });
  }

  renderOutstanding(sign, cfmt) {
    const {classes, recoReport} = this.props;
    const {workflow_types, outstanding_map} = recoReport;
    const {expanded} = this.state;

    const wfTypes = workflow_types[sign] || {};

    const sortable = [];
    Object.keys(wfTypes).forEach(wfType => {
      const title = wfTypeTitles[wfType] || wfType;
      sortable.push({
        wfType: wfType,
        sortKey: `${title.toLowerCase()}|${title}`,
        title: title,
        delta: wfTypes[wfType],
      });
    });

    if (!sortable.length) {
      return [
        <tr key="empty">
          <td colSpan="2"
            className={`${classes.cell} ${classes.emptyTypeCell}`}
          >None</td>
        </tr>
      ];
    }

    sortable.sort((a, b) => {
      const at = a.sortKey;
      const bt = b.sortKey;
      if (at < bt) return -1;
      if (at > bt) return 1;
      return 0;
    });

    const typeRowCN = classes.typeRow;
    const clickableTypeRowCN = `${classes.typeRow} ${classes.clickableRow}`;
    const typeCellCN = `${classes.cell} ${classes.typeCell}`;
    const typeAmountCellCN = `${classes.cell} ${classes.typeAmountCell}`;
    const movementCellCN = `${classes.cell} ${classes.movementCell}`;
    const miniAmountCellCN = `${classes.cell} ${classes.miniAmountCell}`;
    const collapsedCN = `${classes.arrow} ${classes.collapsedArrow}`;
    const expandedCN = `${classes.arrow} ${classes.expandedArrow}`;
    const hiddenArrowCN = `${classes.arrow} ${classes.hiddenArrow}`;
    const transferRowCN = classes.clickableRow;

    const res = [];
    sortable.forEach(item => {
      const expandKey = `${sign}|${item.wfType}`;
      const isExpanded = expanded[expandKey];

      const outstandingList = outstanding_map[sign][item.wfType];

      const trCN = outstandingList ? clickableTypeRowCN : typeRowCN;
      const arrowCN = (
        outstandingList ? (isExpanded ? expandedCN : collapsedCN)
          : hiddenArrowCN);

      res.push(
        <tr className={trCN} key={item.wfType}
          onClick={this.binder1(this.handleExpand, expandKey)}
        >
          <td className={typeCellCN}>
            <span className={arrowCN}>&#x2BC8;</span> {item.title}
          </td>
          <td className={typeAmountCellCN}>
            {item.delta === '0' ? '-' : cfmt(item.delta)}
          </td>
        </tr>
      );

      if (isExpanded) {
        const outstandingList = outstanding_map[sign][item.wfType];
        if (outstandingList) {
          outstandingList.forEach(movement => {
            const date = new Date(movement.ts).toLocaleDateString();
            res.push(
              <tr className={transferRowCN} key={movement.id}>
                <td className={movementCellCN}>
                  <a href="#">Transfer {dashed(movement.transfer_id)} ({date})</a>
                </td>
                <td className={miniAmountCellCN}>
                  {cfmt(movement.delta)}
                </td>
              </tr>
            );
          });
        }
      }
    });

    return res;
  }

  render() {
    const {classes, recoReportURL, recoReport, loading, file} = this.props;
    if (!recoReportURL) {
      // No account selected.
      return null;
    }

    const require = <Require fetcher={fOPNReport} urls={[recoReportURL]} />;

    if (!recoReport) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            <CircularProgress />
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    const {mirror} = recoReport;
    if (!mirror) {
      return 'No account data found';
    }

    let file_date;
    if (file) {
      file_date = file.end_date;
    } else {
      file_date = (new Date()).toLocaleDateString() + ' (current)';
    }

    const {target_title, currency} = mirror;
    const cfmt = new getCurrencyFormatter(currency);

    const labelCellCN = `${classes.cell} ${classes.labelCell}`;
    const amountCellCN = `${classes.cell} ${classes.amountCell}`;

    const bottomLabel = (
      mirror.target_id === 'c' ?
        'Amount in Circulation' :
        'Balance With Outstanding Changes');

    return (
      <Typography className={classes.root} component="div">
        {require}
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`} colSpan="2">
                  {target_title} Reconciliation Report -
                  {' '}{currency}
                  {' '}{mirror.loop_id === '0' ? 'Open Loop' : mirror.loop_title}
                  {' - '}{file_date}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={labelCellCN}>
                  Reconciled Balance
                </td>
                <td className={amountCellCN}>
                  {cfmt(recoReport.reconciled_balance)}
                </td>
              </tr>
              <tr>
                <td className={labelCellCN} colSpan="2">
                  Add: Outstanding Deposits
                </td>
              </tr>
              {this.renderOutstanding('1', cfmt)}
              <tr>
                <td className={labelCellCN} colSpan="2">
                  Subtract: Outstanding Withdrawals
                </td>
              </tr>
              {this.renderOutstanding('-1', cfmt)}
              <tr>
                <td className={labelCellCN}>
                  {bottomLabel}
                </td>
                <td className={amountCellCN}>
                  {cfmt(recoReport.outstanding_balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </Paper>
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {account, file} = ownProps;
  if (account) {
    const recoReportURL = fOPNReport.pathToURL(
      `/reco-report/${account.target_id}/${account.loop_id}/` +
      `${account.currency}/${file ? file.id : ''}`);
    const recoReport = fetchcache.get(state, recoReportURL);
    const loading = fetchcache.fetching(state, recoReportURL);
    const loadError = !!fetchcache.getError(state, recoReportURL);
    return {
      recoReportURL,
      recoReport,
      loading,
      loadError,
    };
  } else {
    return {};
  }
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(RecoReport);
