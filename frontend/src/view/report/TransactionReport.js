import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { setTransferId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import TransactionReportForm from './TransactionReportForm';
import Typography from '@material-ui/core/Typography';
import { wfTypeTitles, dashed } from '../../util/transferfmt';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '1.0rem',
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
  },
  amountCell: {
    textAlign: 'right',
    padding: '4px 8px',
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
    shownRecoTypes: PropTypes.object,
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

  render() {
    const {classes, reportURL, report, loading, file} = this.props;
    if (!reportURL || !file) {
      // No peer loop or file selected.
      return null;
    }

    const require = <Require fetcher={fOPNReport} urls={[reportURL]} />;

    if (!report) {
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

    return (
      <Typography className={classes.root} component="div">
        {require}
        <Paper className={classes.formPaper}>
          <TransactionReportForm />
        </Paper>
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`} colSpan="2">
                  {peer_title} Transaction Report -
                  {' '}{currency}
                  {' '}{file.loop_id === '0' ? 'Open Loop' : file.loop_title}
                  {' - '}{fileDate}
                </th>
              </tr>
            </thead>
            <tbody>
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

  if (ploop) {
    const reportURL = fOPNReport.pathToURL(
      `/transactions/${ploop.ploop_key}/` +
      (file ? file.file_id : 'current'));
    const report = fetchcache.get(state, reportURL);
    const loading = fetchcache.fetching(state, reportURL);
    const loadError = !!fetchcache.getError(state, reportURL);
    const {
      shownRecoTypes,
      rowsPerPage,
    } = state.report;

    return {
      reportURL,
      report,
      loading,
      loadError,
      shownRecoTypes,
      rowsPerPage,
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
