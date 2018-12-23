
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setStatementId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
};


class StatementView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    period: PropTypes.object.isRequired,
    recordURL: PropTypes.string,
    record: PropTypes.object,
    loading: PropTypes.bool,
    loadError: PropTypes.any,
    statementId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  componentDidMount() {
    const {statementId} = this.props;
    if (statementId) {
      this.props.dispatch(setStatementId(statementId));
    }
  }

  render() {
    const {
      classes,
      recordURL,
      record,
      loading,
      loadError,
      statementId,
    } = this.props;

    const statementList = null;

    if (!recordURL) {
      // No statement selected.
      return (
        <div className={classes.root}>
          {statementList}
        </div>
      );
    }

    const require = (
      <Require fetcher={fOPNReco}
        urls={[recordURL]}
        options={{
          // If there's an error, this component will show it. Don't
          // pop up a dialog.
          suppressServerError: true,
        }} />);

    let content;

    if (!record) {
      let paperContent;
      if (loading) {
        paperContent = (
          <div style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </div>);
      } else if (loadError) {
        paperContent = (
          <div style={{padding: '16px'}}>
            <p>{loadError}</p>
          </div>);
      } else {
        paperContent = (
          <div style={{padding: '16px'}}>
            Unable to retrieve statement {statementId}
          </div>);
      }
      content = (
        <Paper className={classes.tablePaper}>
          {paperContent}
        </Paper>
      );
    } else {
      content = (
        <div>
          <Paper className={classes.tablePaper}>
            {this.renderStatement()}
          </Paper>
        </div>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        {statementList}
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const {period, match} = ownProps;
  const statementId = match.params.statementId;

  if (statementId) {
    const encPeriodId = encodeURIComponent(period.id);
    const query = `statement_id=${encodeURIComponent(statementId)}`;
    const recordURL = fOPNReco.pathToURL(
      `/period/${encPeriodId}/statement?${query}`);
    let record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);

    return {
      statementId,
      recordURL,
      record,
      loading,
      loadError,
    };
  } else {
    return {
      statementId,
    };
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(StatementView);
