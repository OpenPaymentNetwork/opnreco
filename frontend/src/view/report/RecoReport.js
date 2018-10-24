import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { toggleNode } from '../../reducer/tree';
import { setTransferId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';
import { wfTypeTitles, dashed } from '../../util/transferfmt';


const styles = {
  root: {
    fontSize: '1.0rem',
    padding: '0 16px',
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


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    recoReportURL: PropTypes.string,
    recoReport: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
    expanded: PropTypes.object,  // a Map or undefined
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleToggleNode(expandKey) {
    this.props.dispatch(toggleNode('reco', expandKey));
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(setTransferId(tid));
      this.props.history.push(`/t/${tid}`);
    }
  }

  renderOutstanding(sign, cfmt) {
    const {classes, recoReport, expanded} = this.props;
    const {workflow_types, outstanding_map} = recoReport;

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
      const isExpanded = expanded ? expanded.get(expandKey) : false;

      const outstandingList = outstanding_map[sign][item.wfType];

      const trCN = outstandingList ? clickableTypeRowCN : typeRowCN;
      const arrowCN = (
        outstandingList ? (isExpanded ? expandedCN : collapsedCN)
          : hiddenArrowCN);

      res.push(
        <tr className={trCN} key={item.wfType}
          onClick={this.binder1(this.handleToggleNode, expandKey)}
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
            const tid = dashed(movement.transfer_id);
            res.push(
              <tr className={transferRowCN} key={movement.movement_id}>
                <td className={movementCellCN}>
                  <a href={`/t/${tid}`}
                    onClick={this.binder1(this.handleClickTransfer, tid)}
                  >
                    Transfer {tid} ({date})
                  </a>
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
    if (!recoReportURL || !file) {
      // No peer loop or file selected.
      return null;
    }

    const require = <Require fetcher={fOPNReport} urls={[recoReportURL]} />;

    if (!recoReport) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            <Paper className={classes.tablePaper}
              style={{textAlign: 'center', }}
            >
              <CircularProgress style={{padding: '16px'}} />
            </Paper>
            <div style={{height: 1}}></div>
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    let fileDate;
    if (file.end_date) {
      fileDate = file.end_date;
    } else {
      fileDate = (new Date()).toLocaleDateString() + ' (current)';
    }

    const {peer_title, currency} = file;
    const cfmt = new getCurrencyFormatter(currency);

    const labelCellCN = `${classes.cell} ${classes.labelCell}`;
    const amountCellCN = `${classes.cell} ${classes.amountCell}`;

    const bottomLabel = (
      file.peer_id === 'c' ?
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
                  {peer_title} Reconciliation Report
                  <div>
                    {currency}
                    {' '}{file.loop_id === '0' ? 'Open Loop' : file.loop_title}
                    {' - '}{fileDate}
                  </div>
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
  const {ploop, file} = ownProps;
  const expanded = state.tree.reco;
  if (ploop) {
    const recoReportURL = fOPNReport.pathToURL(
      `/reco-report?ploop_key=${encodeURIComponent(ploop.ploop_key)}&` +
      `file_id=${encodeURIComponent(file ? file.file_id : 'current')}`);
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
  } else {
    return {expanded};
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(RecoReport);
