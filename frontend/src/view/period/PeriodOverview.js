
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PeriodForm from './PeriodForm';
import PeriodSummary from './PeriodSummary';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';


const tableWidth = '800px';

const styles = {
  content: {
    padding: '16px',
  },
  paperContent: {
    maxWidth: tableWidth,
    margin: '0 auto',
    padding: '16px',
  },
  tablePaper: {
    maxWidth: tableWidth,
    margin: '16px auto',
    padding: 0,
  },
};


class PeriodOverview extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    loading: PropTypes.bool,
    periodId: PropTypes.string,
    queryURL: PropTypes.string.isRequired,
    result: PropTypes.object,
    file: PropTypes.object.isRequired,
  };

  renderContent() {
    const {classes, dispatch, history, result, file} = this.props;
    return (
      <div>
        <Paper className={classes.paperContent}>
          <PeriodForm
            dispatch={dispatch}
            period={result.period}
            deleteConflicts={result.delete_conflicts}
            history={history}
            fileId={file.id}
            archived={file.archived}
          />
        </Paper>
        <Paper className={classes.tablePaper}>
          <PeriodSummary file={file} result={result} />
        </Paper>
      </div>
    );
  }

  render() {
    const {
      classes,
      queryURL,
      result,
      loading,
    } = this.props;

    let content = null;

    if (result) {
      content = this.renderContent();
    } else if (loading) {
      content = (
        <div style={{textAlign: 'center'}}>
          <CircularProgress style={{padding: '16px'}} />
        </div>);
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[queryURL]} />

        <div className={classes.content}>
          {content}
          <div style={{height: 1}}></div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const periodId = ownProps.period.id;
  const queryURL = fOPNReco.pathToURL(
    `/period/${encodeURIComponent(periodId)}/state`);
  const result = fetchcache.get(state, queryURL);
  const loading = fetchcache.fetching(state, queryURL);

  return {
    result,
    queryURL,
    loading,
    periodId,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(PeriodOverview);
