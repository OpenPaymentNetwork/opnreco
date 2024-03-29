
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { isSimpleClick } from '../../util/click';
import { renderReportDate, renderReportHead } from '../../util/reportrender';
import { toggleNode } from '../../reducer/tree';
import { wfTypeTitles, hyphenated } from '../../util/transferfmt';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  tablePaper: {
    margin: '16px auto',
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


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    recoReportURL: PropTypes.string,
    recoReport: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
    period: PropTypes.object,
    expanded: PropTypes.object,  // a Map or undefined
  };

  handleToggleNode = (expandKey) => {
    this.props.dispatch(toggleNode('reco', expandKey));
  };

  handleClickTransfer = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.history.push(path);
    }
  };

  renderOutstanding(sign, cfmt) {
    const { classes, recoReport, expanded, file, period } = this.props;
    const { workflow_types, outstanding_map } = recoReport;

    const wfTypes = workflow_types[sign] || {};
    const showCirc = file.has_vault;
    const encPeriodId = encodeURIComponent(period.id);

    const sortable = [];
    Object.keys(wfTypes).forEach(wfType => {
      const title = wfTypeTitles[wfType] || wfType;
      sortable.push({
        wfType: wfType,
        sortKey: `${title.toLowerCase()}|${title}`,
        title: title,
        deltas: wfTypes[wfType],
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
      const isExpanded = expanded ? expanded.get(expandKey) : false;

      const outstandingList = outstanding_map[sign][item.wfType];

      const trCN = outstandingList ? clickableTypeRowCN : typeRowCN;
      const arrowCN = (
        outstandingList ? (isExpanded ? expandedCN : collapsedCN)
          : hiddenArrowCN);

      let itemCircColumns = null;
      if (showCirc) {
        itemCircColumns = (
          <React.Fragment>
            <td className={typeAmountCellCN}>
              {item.deltas.circ === '0' ? '-' : cfmt(item.deltas.circ)}
            </td>
            <td className={typeAmountCellCN}>
              {item.deltas.surplus === '0' ? '-' : cfmt(item.deltas.surplus)}
            </td>
          </React.Fragment>
        );
      }
      res.push(
        <tr className={trCN} key={item.wfType}
          onClick={() => this.handleToggleNode(expandKey)}
        >
          <td className={typeCellCN}>
            <span className={arrowCN}>&#x2BC8;</span> {item.title}
          </td>
          {itemCircColumns}
          <td className={typeAmountCellCN}>
            {item.deltas.combined === '0' ? '-' : cfmt(item.deltas.combined)}
          </td>
        </tr>
      );

      if (isExpanded) {
        const outstandingList = outstanding_map[sign][item.wfType];
        if (outstandingList) {
          outstandingList.forEach(movement => {
            const tid = hyphenated(movement.transfer_id);
            const transferPath = (
              `/period/${encPeriodId}/t/${encodeURIComponent(tid)}`);
            let movementCircColumns = null;
            if (showCirc) {
              movementCircColumns = (
                <React.Fragment>
                  <td className={miniAmountCellCN}>
                    {movement.circ === '0' ? '-' : cfmt(movement.circ)}
                  </td>
                  <td className={miniAmountCellCN}>
                    {movement.surplus === '0' ? '-' : cfmt(movement.surplus)}
                  </td>
                </React.Fragment>
              );
            }
            const handleClick = (event) => {
              this.handleClickTransfer(event, transferPath);
            };
            res.push(
              <tr className={transferRowCN} key={movement.movement_id}
                onClick={handleClick}>
                <td className={movementCellCN}>
                  <a href={transferPath}>
                    Transfer {tid} (
                    <span title={movement.ts}>
                      <FormattedDate
                        value={movement.ts}
                        day="numeric" month="short" year="numeric" />)
                    </span>
                  </a>
                </td>
                {movementCircColumns}
                <td className={miniAmountCellCN}>
                  {cfmt(movement.combined)}
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
    const {
      classes,
      recoReportURL,
      recoReport,
      loading,
      file,
      period,
    } = this.props;
    if (!recoReportURL || !file) {
      // No period or file selected.
      return null;
    }

    const require = (
      <div>
        <Require fetcher={fOPNReco} urls={[recoReportURL]} />
      </div>);

    if (!recoReport) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            <Paper className={classes.tablePaper}
              style={{ textAlign: 'center', }}
            >
              <CircularProgress style={{ padding: '16px' }} />
            </Paper>
            <div style={{ height: 1 }}></div>
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    const reportDate = renderReportDate(period, recoReport.now);

    const cfmt = new getCurrencyFormatter(file.currency);

    const labelCellCN = `${classes.cell} ${classes.labelCell}`;
    const amountCellCN = `${classes.cell} ${classes.amountCell}`;

    let headRow, recoTotalRow, outstandingTotalRow, columnCount;
    if (file.has_vault) {
      columnCount = 4;
      headRow = (
        <tr>
          <td className={labelCellCN} width="55%">
          </td>
          <td className={amountCellCN} width="15%">
            Circulation
          </td>
          <td className={amountCellCN} width="15%">
            Surplus/Deficit
          </td>
          <td className={amountCellCN} width="15%">
            Combined
          </td>
        </tr>
      );
      recoTotalRow = (
        <tr>
          <td className={labelCellCN} width="55%">
            Reconciled Balance
          </td>
          <td className={amountCellCN} width="15%">
            {cfmt(recoReport.reconciled_totals.circ)}
          </td>
          <td className={amountCellCN} width="15%">
            {cfmt(recoReport.reconciled_totals.surplus)}
          </td>
          <td className={amountCellCN} width="15%">
            {cfmt(recoReport.reconciled_totals.combined)}
          </td>
        </tr>
      );
      outstandingTotalRow = (
        <tr>
          <td className={labelCellCN}>
            Balance With Outstanding Changes
          </td>
          <td className={amountCellCN}>
            {cfmt(recoReport.outstanding_totals.circ)}
          </td>
          <td className={amountCellCN}>
            {cfmt(recoReport.outstanding_totals.surplus)}
          </td>
          <td className={amountCellCN}>
            {cfmt(recoReport.outstanding_totals.combined)}
          </td>
        </tr>
      );

    } else {
      columnCount = 2;
      headRow = null;
      recoTotalRow = (
        <tr>
          <td className={labelCellCN} width="80%">
            Reconciled Balance
          </td>
          <td className={amountCellCN} width="20%">
            {cfmt(recoReport.reconciled_totals.combined)}
          </td>
        </tr>
      );
      outstandingTotalRow = (
        <tr>
          <td className={labelCellCN}>
            Balance With Outstanding Changes
          </td>
          <td className={amountCellCN}>
            {cfmt(recoReport.outstanding_totals.combined)}
          </td>
        </tr>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`}
                  colSpan={columnCount}>
                  {renderReportHead(file, 'Reconciliation Report', reportDate)}
                </th>
              </tr>
              {headRow}
            </thead>
            <tbody>
              {recoTotalRow}
              <tr>
                <td className={labelCellCN} colSpan={columnCount}>
                  Add: Outstanding Deposits
                </td>
              </tr>
              {this.renderOutstanding('1', cfmt)}
              <tr>
                <td className={labelCellCN} colSpan={columnCount}>
                  Subtract: Outstanding Withdrawals
                </td>
              </tr>
              {this.renderOutstanding('-1', cfmt)}
              {outstandingTotalRow}
            </tbody>
          </table>
        </Paper>
        <div style={{ height: 1 }}></div>
      </Typography>
    );
  }

}


function mapStateToProps(state, ownProps) {
  const { period } = ownProps;
  const expanded = state.tree.reco;
  const recoReportURL = fOPNReco.pathToURL(
    `/period/${encodeURIComponent(period.id)}/reco-report`);
  const recoReport = fetchcache.get(state, recoReportURL);
  const loading = fetchcache.fetching(state, recoReportURL);
  const loadError = !!fetchcache.getError(state, recoReportURL);
  return {
    recoReportURL,
    recoReport,
    loading,
    loadError,
    expanded,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(RecoReport);
