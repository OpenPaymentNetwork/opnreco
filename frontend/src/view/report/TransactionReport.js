import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { setTransferId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon
  from '@material-ui/icons/CheckBoxOutlineBlank';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import TransactionReportForm from './TransactionReportForm';
import Typography from '@material-ui/core/Typography';
import { FormattedDate } from 'react-intl';
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
  },
  numberCell: {
    padding: '2px 8px',
    textAlign: 'right',
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
    paddingTop: '4px',
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
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(setTransferId(tid));
      this.props.history.push(`/t/${tid}`);
    }
  }

  renderBody(records, totals, subtitle) {
    const {
      classes,
      ploop,
      report: {all_shown},
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
            Note Activity
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

      records.forEach((record, index) => {

        const tid = record.transfer_id ? dashed(record.transfer_id) : null;
        let transferLink = null;
        if (tid) {
          transferLink = (
            <a href={`/t/${record.transfer_id}`}
              onClick={this.binder1(this.handleClickTransfer, tid)}
            >{tid}</a>
          );
        }

        let recoContent;
        if (record.reco_id !== null) {
          recoContent = <CheckBoxIcon />;
        } else {
          recoContent = <CheckBoxOutlineBlankIcon />;
        }

        rows.push(
          <tr key={index}>
            <td className={txtCell}>
              {record.entry_date ?
                <FormattedDate value={record.entry_date}
                  day="numeric" month="short" year="numeric" />
                : null}
            </td>
            <td className={numGroupEndCell}>
              {record.account_delta ? fmt(record.account_delta) : null}
            </td>
            <td className={txtCell} title={record.ts}>
              {record.ts ?
                <FormattedDate value={record.ts}
                  day="numeric" month="short" year="numeric" />
                : null}
            </td>
            <td className={numCell}>
              {record.movement_delta ? fmt(record.movement_delta) : null}
            </td>
            <td className={txtCell}>
              {record.workflow_type ?
                (wfTypeTitles[record.workflow_type] || record.workflow_type)
                : null}
            </td>
            <td className={txtGroupEndCell}>
              {transferLink}
            </td>
            <td className={chkCell}>
              {recoContent}
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
            {fmt(totals.page.movement_delta)}
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
          {fmt(totals.all.movement_delta)}
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
    const {classes, reportURL, report, loading, file} = this.props;
    if (!reportURL || !file) {
      // No peer loop or file selected.
      return null;
    }

    let content, rowcount;

    if (report) {
      let fileDate;
      if (file.end_date) {
        fileDate = (
          <FormattedDate value={file.end_date}
            day="numeric" month="short" year="numeric" />);
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
        <Require fetcher={fOPNReport} urls={[reportURL]} />
        <Paper className={classes.formPaper}>
          <TransactionReportForm rowcount={rowcount} />
        </Paper>
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {ploop, file} = ownProps;

  if (ploop) {
    const {
      rowsPerPage,
      pageIndex,
    } = state.report;

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
    return {};
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(TransactionReport);
