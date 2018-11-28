import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import LayoutConfig from '../app/LayoutConfig';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import RecoCheckBox from './RecoCheckBox';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';
import { FormattedDate } from 'react-intl';
import { setRowsPerPage, setPageIndex } from '../../reducer/report';
import { wfTypeTitles, dashed } from '../../util/transferfmt';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  formPaper: {
    margin: '16px auto',
    maxWidth: tableWidth - 16,
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
    file: PropTypes.object,
    ploop: PropTypes.object,
    rowsPerPage: PropTypes.number,
    pageIndex: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.history.push(`/t/${tid}`);
    }
  }

  setRowsPerPage(rows) {
    this.props.dispatch(setRowsPerPage(rows));
  }

  setPageIndex(pageIndex) {
    this.props.dispatch(setPageIndex(pageIndex));
  }

  renderBody(records, totals, subtitle) {
    const {
      classes,
      ploop,
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
    const fmt = getCurrencyFormatter(ploop.currency);

    const rows = [];
    if (!records || !records.length) {
      rows.push(
        <tr key="empty1">
          <td className={txtCell} colSpan="7">
            <em>No entries.</em>
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
            {ploop.peer_id === 'c' ?
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
        const tid = m.transfer_id ? dashed(m.transfer_id) : null;
        return (
          <a href={`/t/${m.transfer_id}`}
            onClick={this.binder1(this.handleClickTransfer, tid)}
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
      file,
      pageIndex,
      rowsPerPage,
    } = this.props;
    if (!reportURL || !file) {
      // No peer loop or file selected.
      return null;
    }

    let content, rowcount;

    if (report) {
      let fileDate;
      if (file.end_date) {
        fileDate = (
          <FormattedDate value={file.end_date} title={file.end_date}
            day="numeric" month="short" year="numeric" timeZone="UTC" />);
      } else {
        fileDate = (
          <span title={report.now}>
            <FormattedDate value={report.now}
              day="numeric" month="short" year="numeric" /> (in progress)
          </span>);
      }

      const {peer_title, currency} = file;

      rowcount = report.rowcount;
      content = (
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`}
                  colSpan="7"
                >
                  {peer_title} Transaction Report
                  <div>
                    {currency}
                    {' '}{file.loop_id === '0' ? 'Open Loop' : file.loop_title}
                    {' - '}{fileDate}
                  </div>
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
      rowcount = 0;
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
        <LayoutConfig title="Transactions Report" />
        <Require fetcher={fOPNReport} urls={[reportURL]} />
        <Paper className={classes.formPaper}>
          <Pager
            pageIndex={pageIndex}
            rowsPerPage={rowsPerPage}
            rowcount={rowcount}
            setRowsPerPage={this.binder(this.setRowsPerPage)}
            setPageIndex={this.binder(this.setPageIndex)}
          />
        </Paper>
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {ploop, file} = ownProps;
  const {
    rowsPerPage,
    pageIndex,
  } = state.report;

  if (ploop) {
    const reportURL = fOPNReport.pathToURL(
      `/transactions?ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&file_id=${encodeURIComponent(file ? file.file_id : 'current')}` +
      `&offset=${encodeURIComponent(
        rowsPerPage ? pageIndex * rowsPerPage : 0)}` +
      `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);
    const report = fetchcache.get(state, reportURL);
    const loading = fetchcache.fetching(state, reportURL);
    const loadError = !!fetchcache.getError(state, reportURL);

    return {
      reportURL,
      report,
      loading,
      loadError,
      rowsPerPage,
      pageIndex,
    };
  } else {
    return {
      rowsPerPage,
      pageIndex,
    };
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(TransactionReport);
