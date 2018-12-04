import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import Require from '../../util/Require';
import Paper from '@material-ui/core/Paper';


const styles = {
  content: {
    padding: '16px',
  },
  paperContent: {
    padding: '16px',
  },
};


class FileView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    file: PropTypes.object,
    fileURL: PropTypes.string.isRequired,
    loading: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  render() {
    const {
      classes,
      file,
      fileURL,
      loading,
    } = this.props;

    let paperContent = null;

    if (file || true) {
      paperContent = <div>form here.</div>;
    } else if (loading) {
      paperContent = (
        <div style={{textAlign: 'center'}}>
          <CircularProgress style={{padding: '16px'}} />
        </div>);
    }

    return (
      <div className={classes.root}>
        <LayoutConfig title="File" />
        <Require fetcher={fOPNReco} urls={[fileURL]} />

        <OPNAppBar />

        <div className={classes.content}>
          <Paper className={classes.paperContent}>
            {paperContent}
            <div style={{height: 1}}></div>
          </Paper>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const {match} = ownProps;
  const fileURL = fOPNReco.pathToURL(
    `/file?file_id=${encodeURIComponent(match.params.file_id)}`);
  const file = fetchcache.get(state, fileURL);
  const loading = fetchcache.fetching(state, fileURL);

  return {
    file,
    fileURL,
    loading,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileView);
