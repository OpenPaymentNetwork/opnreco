
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { getPagerState } from '../../reducer/pager';
import { renderReportDate } from '../../util/reportrender';
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
import { wfTypeTitles, dashed } from '../../util/transferfmt';
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
};


class InternalRecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    reportURL: PropTypes.string,
    report: PropTypes.object,
    loading: PropTypes.bool,
    period: PropTypes.object,
    ploop: PropTypes.object,
    pagerName: PropTypes.string.isRequired,
    initialRowsPerPage: PropTypes.number.isRequired,
  };

  handleClickTransfer = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  renderBody(records, totals, showVault) {
    const {
      classes,
      period,
      ploop,
      report: {all_shown},
      dispatch,
    } = this.props;

    const {
      cell,
      pageTotalCell,
      totalCell,
    } = classes;

    const txtCell = `${cell} ${classes.textCell}`;
    const numCell = `${cell} ${classes.numberCell}`;
    const chkCell = `${cell} ${classes.checkCell}`;
    const fmt = getCurrencyDeltaFormatter(ploop.currency);
    const encPeriodId = encodeURIComponent(period.id);

    const rows = [];
    if (!records || !records.length) {
      rows.push(
        <tr key="empty1">
          <td className={txtCell} colSpan="7">
            <em>
              There are no internal reconciliations to display for this period.
            </em>
          </td>
        </tr>
      );
    } else {

      rows.push(
        <tr key="activityHead2">
          <th className={txtCell}>
            Date
          </th>
          {showVault &&
            <th className={txtCell}>
              Vault
            </th>
          }
          <th className={txtCell}>
            Wallet
          </th>
          <th className={txtCell}>
            Type
          </th>
          <th className={txtCell}>
            Transfer
          </th>
          <th className={txtCell}>
            Reconciled
          </th>
        </tr>
      );

      const renderTransferLink = (m) => {
        if (!m.transfer_id) {
          return <span>&nbsp;</span>;
        }
        const tid = dashed(m.transfer_id);
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
              data-reco-id={record.reco_id}>
            <td className={txtCell}>
              {record.movements.map((m, i) => (
                <div key={i} title={m.ts} data-movement-id={m.id}>
                  <FormattedDate value={m.ts}
                    day="numeric" month="short" year="numeric" />
                </div>
              ))}
            </td>
            {showVault &&
              <td className={numCell}>
                {record.movements.map((m, i) => (
                  <div key={i} data-movement-id={m.id}>
                    {fmt(m.vault_delta)}
                  </div>
                ))}
              </td>
            }
            <td className={numCell}>
              {record.movements.map((m, i) => (
                <div key={i} data-movement-id={m.id}>
                  {fmt(m.wallet_delta)}
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
            <td className={txtCell}>
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
          {showVault &&
            <td className={`${numCell} ${pageTotalCell}`}>
              {fmt(totals.page.vault_delta)}
            </td>
          }
          <td className={`${numCell} ${pageTotalCell}`}>
            {fmt(totals.page.wallet_delta)}
          </td>
          <td className={txtCell}>
          </td>
          <td className={txtCell}>
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
        {showVault &&
          <td className={`${numCell} ${totalCell}`}>
            {fmt(totals.all.vault_delta)}
          </td>
        }
        <td className={`${numCell} ${totalCell}`}>
          {fmt(totals.all.wallet_delta)}
        </td>
        <td className={txtCell}>
        </td>
        <td className={txtCell}>
        </td>
        <td className={txtCell}>
        </td>
      </tr>
    );

    return (
      <tbody>
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
      ploop,
      pagerName,
      initialRowsPerPage,
    } = this.props;

    if (!reportURL || !period) {
      // No peer loop or period selected.
      return null;
    }

    let content, rowcount;

    if (report) {
      const reportDate = renderReportDate(period, report.now);
      const showVault = report.show_vault;
      const colCount = showVault ? 6 : 5;

      rowcount = report.rowcount;
      content = (
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`}
                  colSpan={colCount}
                >
                  {ploop.peer_title} Internal Reconciliations
                  <div>
                    {ploop.currency}
                    {' '}{ploop.loop_id === '0' ? 'Open Loop' : ploop.loop_title}
                    {' - '}{reportDate}
                  </div>
                </th>
              </tr>
            </thead>
            {this.renderBody(report.records, report.totals, report.show_vault)}
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
  const pagerName = 'InternalRecoReport';
  const {period} = ownProps;

  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 100);

  const reportURL = fOPNReco.pathToURL(
    `/period/${encodeURIComponent(period.id)}/internal` +
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
)(InternalRecoReport);
