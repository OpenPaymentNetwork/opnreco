
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { getPagerState } from '../../reducer/pager';
import { renderReportDate, renderReportHead } from '../../util/reportrender';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import RecoCheckBox from './RecoCheckBox';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';
import { FormattedDate } from 'react-intl';
import { wfTypeTitles, hyphenated } from '../../util/transferfmt';
import { isSimpleClick } from '../../util/click';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  pagerPaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
    padding: '8px',
  },
  tablePaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
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
    textAlign: 'center',
  },
  subtitleCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#eee',
    textAlign: 'center',
  },
  activityHeadCell: {
    fontWeight: 'normal',
    textAlign: 'center',
  },
  groupEndCell: {
    borderRight: '4px solid #bbb',
  },
  textCell: {
    padding: '2px 8px',
    fontWeight: 'normal',
    textAlign: 'left',
    verticalAlign: 'top',
  },
  numberCell: {
    padding: '2px 8px',
    textAlign: 'right',
    verticalAlign: 'top',
  },
  pageTotalCell: {
    padding: '2px 8px',
    color: '#777',
  },
  totalCell: {
    padding: '2px 8px',
    fontWeight: 'bold',
  },
  checkCell: {
    textAlign: 'center',
    padding: '0',
    verticalAlign: 'top',
  },
  strikeout: {
    textDecoration: 'line-through',
    opacity: '0.3',
  },
};


class TransactionReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    reportURL: PropTypes.string,
    report: PropTypes.object,
    loading: PropTypes.bool,
    period: PropTypes.object,
    file: PropTypes.object,
    pagerName: PropTypes.string.isRequired,
    initialRowsPerPage: PropTypes.number.isRequired,
  };

  handleClickTransfer = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  renderBody(records, totals, subtitle) {
    const {
      classes,
      period,
      file,
      report: {all_shown},
      dispatch,
    } = this.props;

    const {
      cell,
      groupEndCell,
      pageTotalCell,
      totalCell,
    } = classes;

    const txtCell = `${cell} ${classes.textCell}`;
    const numCell = `${cell} ${classes.numberCell}`;
    const chkCell = `${cell} ${classes.checkCell}`;
    const txtGroupEndCell = `${txtCell} ${groupEndCell}`;
    const numGroupEndCell = `${numCell} ${groupEndCell}`;
    const activityHeadCell = `${cell} ${classes.activityHeadCell}`;
    const fmt = getCurrencyFormatter(file.currency);
    const encPeriodId = encodeURIComponent(period.id);

    const rows = [];
    if (!records || !records.length) {
      rows.push(
        <tr key="empty1">
          <td className={txtCell} colSpan="7">
            <em>There are no transactions to display for this period.</em>
          </td>
        </tr>
      );
    } else {

      rows.push(
        <tr key="activityHead1">
          <th className={`${activityHeadCell} ${groupEndCell}`} colSpan="2">
            Account Activity
          </th>
          <th className={`${activityHeadCell} ${groupEndCell}`} colSpan="4">
            {file.has_vault ?
              'Wallet and Vault Activity' : 'Wallet Activity'}
          </th>
          <th className={activityHeadCell}>
          </th>
        </tr>
      );
      rows.push(
        <tr key="activityHead2">
          <th className={txtCell}>
            Date
          </th>
          <th className={`${txtCell} ${groupEndCell}`}>
            Amount
          </th>
          <th className={txtCell}>
            Date
          </th>
          <th className={txtCell}>
            Amount
          </th>
          <th className={txtCell}>
            Type
          </th>
          <th className={`${txtCell} ${groupEndCell}`}>
            Transfer
          </th>
          <th className={txtCell}>
            Reconciled
          </th>
        </tr>
      );

      const renderAmountCell = (m) => {
        if (m.movement_delta && m.movement_delta !== '0') {
          if (!m.reco_movement_delta || m.reco_movement_delta === '0') {
            return (
              <span className={classes.strikeout}>
                {fmt(m.movement_delta)}
              </span>
            );
          } else {
            return fmt(m.reco_movement_delta);
          }
        } else {
          return <span>&nbsp;</span>;
        }
      };

      const renderTransferLink = (m) => {
        if (!m.transfer_id) {
          return <span>&nbsp;</span>;
        }
        const tid = hyphenated(m.transfer_id);
        const transferPath = (
          `/period/${encPeriodId}/t/${encodeURIComponent(tid)}`);
        return (
          <a href={transferPath}
            onClick={(event) => this.handleClickTransfer(event, transferPath)}
          >{tid}</a>
        );
      };

      records.forEach((record, index) => {
        rows.push(
          <tr key={index}
              data-movement-id={record.movement_id}
              data-account-entry-id={record.account_entry_id}
              data-reco-id={record.reco_id}>
            <td className={txtCell}>
              {record.account_entries.map((entry, i) => (
                <div key={i} title={entry.entry_date}
                    data-account-entry-id={entry.id}>
                  <FormattedDate value={entry.entry_date}
                    day="numeric" month="short" year="numeric"
                    timeZone="UTC" />
                </div>
              ))}
            </td>
            <td className={numGroupEndCell}>
              {record.account_entries.map((entry, i) => (
                <div key={i} data-account-entry-id={entry.id}>
                  {fmt(entry.account_delta)}
                </div>
              ))}
            </td>
            <td className={txtCell}>
              {record.movements.map((m, i) => (
                <div key={i} title={m.ts} data-movement-id={m.id}>
                  <FormattedDate value={m.ts}
                    day="numeric" month="short" year="numeric" />
                </div>
              ))}
            </td>
            <td className={numCell}>
              {record.movements.map((m, i) => (
                <div key={i} data-movement-id={m.id}>
                  {renderAmountCell(m)}
                </div>
              ))}
            </td>
            <td className={txtCell}>
              {record.movements.map((m, i) => (
                <div key={i} data-movement-id={m.id}>
                  {wfTypeTitles[m.workflow_type] || m.workflow_type}
                </div>
              ))}
            </td>
            <td className={txtGroupEndCell}>
              {record.movements.map((m, i) => (
                <div key={i} data-movement-id={m.id}>
                  {renderTransferLink(m)}
                </div>
              ))}
            </td>
            <td className={chkCell}>
              <RecoCheckBox
                periodId={period.id}
                recoId={record.reco_id}
                movementId={record.movement_id}
                accountEntryId={record.account_entry_id}
                dispatch={dispatch} />
            </td>
          </tr>
        );
      });
    }

    if (!all_shown) {
      rows.push(
        <tr key="pagetotal">
          <td className={`${cell} ${pageTotalCell}`}>
            Page Total
          </td>
          <td className={`${numCell} ${pageTotalCell} ${groupEndCell}`}>
            {fmt(totals.page.account_delta)}
          </td>
          <td className={txtCell}>
          </td>
          <td className={`${numCell} ${pageTotalCell}`}>
            {fmt(totals.page.reco_movement_delta)}
          </td>
          <td className={txtCell}>
          </td>
          <td className={`${txtCell} ${groupEndCell}`}>
          </td>
          <td className={txtCell}>
          </td>
        </tr>
      );
    }

    rows.push(
      <tr key="alltotal">
        <td className={`${cell} ${totalCell}`}>
          Total
        </td>
        <td className={`${numCell} ${totalCell} ${groupEndCell}`}>
          {fmt(totals.all.account_delta)}
        </td>
        <td className={txtCell}>
        </td>
        <td className={`${numCell} ${totalCell}`}>
          {fmt(totals.all.reco_movement_delta)}
        </td>
        <td className={txtCell}>
        </td>
        <td className={`${txtCell} ${groupEndCell}`}>
        </td>
        <td className={txtCell}>
        </td>
      </tr>
    );

    rows.push(
      <tr key="spacer">
        <td className={txtCell}>
          &nbsp;
        </td>
        <td className={`${txtCell} ${groupEndCell}`}>
        </td>
        <td className={txtCell}>
        </td>
        <td className={txtCell}>
        </td>
        <td className={txtCell}>
        </td>
        <td className={`${txtCell} ${groupEndCell}`}>
        </td>
        <td className={txtCell}>
        </td>
      </tr>
    );


    return (
      <tbody>
        <tr>
          <th colSpan="7"
            className={`${cell} ${classes.subtitleCell}`}
          >{subtitle}</th>
        </tr>
        {rows}
      </tbody>
    );
  }

  render() {
    const {
      classes,
      reportURL,
      report,
      loading,
      period,
      file,
      pagerName,
      initialRowsPerPage,
    } = this.props;

    if (!reportURL || !period) {
      // No file or period selected.
      return null;
    }

    let content, rowcount;

    if (report) {
      const reportDate = renderReportDate(period, report.now);

      rowcount = report.rowcount;
      content = (
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`}
                  colSpan="7"
                >
                  {renderReportHead(file, 'Transaction Report', reportDate)}
                </th>
              </tr>
            </thead>
            {this.renderBody(
              report.inc_records,
              report.inc_totals,
              'Deposits (increase account balance)')}
            {this.renderBody(
              report.dec_records,
              report.dec_totals,
              'Withdrawals (decrease account balance)')}
          </table>
        </Paper>
      );

    } else {
      rowcount = null;
      if (loading) {
        content = (
          <Paper className={classes.tablePaper} style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </Paper>
        );
      } else {
        content = null;
      }
    }

    return (
      <Typography className={classes.root} component="div">
        <Require fetcher={fOPNReco} urls={[reportURL]} />
        <Paper className={classes.pagerPaper}>
          <Pager
            name={pagerName}
            initialRowsPerPage={initialRowsPerPage}
            rowcount={rowcount} />
        </Paper>
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const pagerName = 'TransactionReport';
  const {period} = ownProps;

  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 100);

  const reportURL = fOPNReco.pathToURL(
    `/period/${encodeURIComponent(period.id)}/transactions` +
    `?offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
    `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);
  const report = fetchcache.get(state, reportURL);
  const loading = fetchcache.fetching(state, reportURL);
  const loadError = !!fetchcache.getError(state, reportURL);

  return {
    reportURL,
    report,
    loading,
    loadError,
    pagerName,
    initialRowsPerPage,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(TransactionReport);
